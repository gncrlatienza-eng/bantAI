package com.bantai

import android.app.Application
import com.bantai.util.OwnNumber

class BantaiApp : Application() {
    val container by lazy { AppContainer(this) }

    override fun onCreate() {
        super.onCreate()
        OwnNumber.start(this)
    }
}
