package com.bantai.data.remote

import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

/**
 * Audit ANDROID-01 (2026-10-13): the SMS receiver bounds classification with
 * withTimeoutOrNull, but blocking HttpURLConnection I/O ignored cancellation,
 * so the caller waited out the full read timeout before its offline fallback.
 */
class HttpClientCancellationTest {
    private lateinit var server: ServerSocket
    private val accepted = CopyOnWriteArrayList<Socket>()

    @Before
    fun startServer() {
        server = ServerSocket(0)
    }

    @After
    fun stopServer() {
        accepted.forEach { runCatching { it.close() } }
        server.close()
    }

    /** Accepts connections and holds them open without ever answering. */
    private fun neverRespond() {
        thread(isDaemon = true) {
            while (!server.isClosed) {
                runCatching { accepted += server.accept() }
            }
        }
    }

    private fun url() = URL("http://127.0.0.1:${server.localPort}/stuck")

    @Test
    fun `a timed-out caller is released promptly, not after the read timeout`() {
        neverRespond()
        val started = System.nanoTime()

        val outcome =
            runBlocking {
                withTimeoutOrNull(CALLER_TIMEOUT_MS) {
                    HttpClient.requestUrl(url(), "GET", timeoutMs = READ_TIMEOUT_MS)
                }
            }

        val elapsedMs = (System.nanoTime() - started) / 1_000_000
        assertNull(outcome)
        assertTrue(
            "caller waited ${elapsedMs}ms for a ${CALLER_TIMEOUT_MS}ms timeout (read timeout $READ_TIMEOUT_MS)",
            elapsedMs < PROMPT_RELEASE_BOUND_MS,
        )
    }

    @Test
    fun `a normal response still succeeds`() {
        thread(isDaemon = true) {
            server.accept().use { socket ->
                socket.getInputStream().bufferedReader().let { reader ->
                    while (reader.readLine()?.isNotEmpty() == true) Unit
                }
                socket.getOutputStream().write(
                    "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok".toByteArray(),
                )
            }
        }

        val result = runBlocking { HttpClient.requestUrl(url(), "GET", timeoutMs = READ_TIMEOUT_MS) }

        assertEquals("ok", result.getOrThrow())
    }

    private companion object {
        const val CALLER_TIMEOUT_MS = 200L
        const val READ_TIMEOUT_MS = 10_000
        const val PROMPT_RELEASE_BOUND_MS = 2_000L
    }
}
