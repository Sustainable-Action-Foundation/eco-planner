FROM mariadb:lts AS base

ENV MARIADB_ROOT_PASSWORD=admin
ENV MARIADB_DATABASE=eco-planner

HEALTHCHECK --interval=3s --timeout=5s --start-period=5s --retries=10 \
  CMD healthcheck.sh --connect --innodb_initialized

EXPOSE 3306