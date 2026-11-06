FROM postgres:16

COPY infra/azure/db-init.sql /opt/bantai/db-init.sql
COPY infra/azure/db-init.sh /usr/local/bin/bantai-db-init
RUN chmod 0555 /usr/local/bin/bantai-db-init \
  && chmod 0444 /opt/bantai/db-init.sql

ENTRYPOINT ["/usr/local/bin/bantai-db-init"]
