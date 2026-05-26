#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MONGO_URI="${RHINOPEAK_MONGO_URI:-mongodb://localhost:27017/rhinopeak_dashboard}"
REDIS_URL="${RHINOPEAK_REDIS_URL:-redis://localhost:6379/0}"
S3_BUCKET="${RHINOPEAK_BACKUP_S3_BUCKET:-}"
STAMP="$(date -u +%Y%m%d_%H%M%S)"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

upload_dir() {
  local local_dir="$1"
  local remote_prefix="$2"
  if [[ -n "$S3_BUCKET" ]]; then
    need aws
    aws s3 sync "$local_dir" "s3://${S3_BUCKET}/${remote_prefix}/"
  fi
}

backup_mongodb() {
  need mongodump
  local out="${BACKUP_DIR}/mongodb/${STAMP}"
  mkdir -p "$out"
  mongodump --uri="$MONGO_URI" --gzip --out="${out}/dump"
  find "${out}/dump" -type f -print0 | sort -z | xargs -0 sha256sum > "${out}/SHA256SUMS"
  upload_dir "$out" "mongodb/${STAMP}"
  echo "$out"
}

backup_redis() {
  need redis-cli
  local out="${BACKUP_DIR}/redis/${STAMP}"
  mkdir -p "$out"
  local without_scheme="${REDIS_URL#redis://}"
  local host_port="${without_scheme%%/*}"
  local db="${without_scheme##*/}"
  local host="${host_port%%:*}"
  local port="${host_port##*:}"
  redis-cli -h "$host" -p "$port" -n "$db" --rdb "${out}/dump.rdb"
  gzip -f "${out}/dump.rdb"
  sha256sum "${out}/dump.rdb.gz" > "${out}/SHA256SUMS"
  upload_dir "$out" "redis/${STAMP}"
  echo "$out"
}

cleanup() {
  mkdir -p "$BACKUP_DIR"
  find "$BACKUP_DIR" -mindepth 2 -maxdepth 2 -type d -mtime +"$RETENTION_DAYS" -print -exec rm -rf {} +
}

restore_mongodb() {
  need mongorestore
  local source_dir="${1:?Usage: $0 restore-mongodb <backup-dir>}"
  if [[ -f "${source_dir}/SHA256SUMS" ]]; then
    (cd "$source_dir" && sha256sum -c SHA256SUMS)
  fi
  mongorestore --uri="$MONGO_URI" --gzip --drop "${source_dir}/dump"
}

case "${1:-full}" in
  full)
    mkdir -p "$BACKUP_DIR"
    backup_mongodb
    backup_redis || echo "Redis backup skipped or failed; continuing with MongoDB backup." >&2
    cleanup
    ;;
  mongodb)
    backup_mongodb
    ;;
  redis)
    backup_redis
    ;;
  cleanup)
    cleanup
    ;;
  restore-mongodb)
    restore_mongodb "${2:-}"
    ;;
  *)
    echo "Usage: $0 {full|mongodb|redis|cleanup|restore-mongodb}" >&2
    exit 1
    ;;
esac
