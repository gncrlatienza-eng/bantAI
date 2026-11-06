# syntax=docker/dockerfile:1.7
# Adds a separately supplied, hash-verified Model-C bundle and approval manifest
# to the already-reviewed inference image. The private artifacts never enter the
# repository build context.
ARG BASE_IMAGE=bantai-ai:b5dd870
FROM ${BASE_IMAGE}

USER root
COPY --from=model --chown=10001:10001 . /models/model/
COPY --from=approval --chown=10001:10001 model-approval.json /run/bantai/model-approval.json
USER 10001:10001
