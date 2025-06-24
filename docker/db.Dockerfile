FROM mariadb:lts AS base

ENV MARIADB_ROOT_PASSWORD=admin
ENV MARIADB_DATABASE=eco-planner

HEALTHCHECK --interval=3s --timeout=10s --start-period=5s --retries=5 \
  CMD healthcheck.sh --connect --innodb_initialized

EXPOSE 3306