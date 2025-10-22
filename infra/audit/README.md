# Audit Log Sink

Use an object storage bucket that supports write-once-read-many (WORM) retention locking or an append-only log stream service (for example, CloudWatch Logs with retention policies and restricted access).

Store daily files with the prefix `audit/yyyy/mm/dd/…jsonl` to keep entries partitioned for efficient discovery.
