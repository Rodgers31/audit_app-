# Operational Runbook

## Quick Reference

**Emergency Contacts:**

- On-Call Engineer: [Add contact]
- DevOps Lead: [Add contact]
- Database Admin: [Add contact]
- Security Contact: [Add contact]

**Key URLs:**

- Production API: https://api.yourdomain.com
- Status Page: https://status.yourdomain.com
- Monitoring: https://grafana.yourdomain.com
- Logs: https://logs.yourdomain.com
- Error Tracking: https://sentry.io/your-org/audit-app

---

## Common Incidents & Resolutions

### 1. API Service Down

**Symptoms:**

- Health check returning 503 or timing out
- Alert: "APIDown" triggered
- Users unable to access the application

**Diagnosis:**

```bash
# Check service status
docker ps | grep backend
# or
kubectl get pods -l app=audit-app-backend

# Check logs
docker logs audit-app-backend --tail=100
# or
kubectl logs -l app=audit-app-backend --tail=100
```

**Resolution:**

```bash
# Restart service
docker-compose restart backend
# or
kubectl rollout restart deployment/audit-app-backend

# If restart doesn't help, rollback
docker-compose down && docker-compose -f docker-compose.previous.yml up -d
# or
kubectl rollout undo deployment/audit-app-backend
```

**Prevention:**

- Review logs for crash cause
- Check resource limits (CPU/memory)
- Verify database connectivity

---

### 2. Database Connection Issues

**Symptoms:**

- API returns 500 errors
- Alert: "DatabaseDown" or "DatabaseConnectionPoolExhausted"
- Logs show "connection refused" or "too many connections"

**Diagnosis:**

```bash
# Check database status
docker exec -it postgres pg_isready
# or
psql -h your-db-host -U postgres -c "SELECT 1"

# Check connection count
docker exec -it postgres psql -U postgres -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='audit_app';"

# Check slow queries
docker exec -it postgres psql -U postgres -c \
  "SELECT pid, now() - query_start as duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND now() - query_start > interval '30 seconds';"
```

**Resolution:**

**If database is down:**

```bash
# Restart PostgreSQL
docker-compose restart postgres
# or
kubectl rollout restart statefulset/postgres

# Restore from backup if corrupted
docker exec -it postgres pg_restore -U postgres -d audit_app /backups/latest.dump
```

**If connection pool exhausted:**

```bash
# Restart backend to reset connections
docker-compose restart backend

# Kill long-running queries
docker exec -it postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle in transaction' AND now() - state_change > interval '10 minutes';"
```

**Prevention:**

- Increase connection pool size in settings
- Add pgbouncer for connection pooling
- Review and optimize slow queries

---

### 3. ETL Job Failures

**Symptoms:**

- Alert: "ETLJobFailed" or "ETLJobNotRunning"
- Stale data in the dashboard
- Logs show extraction errors

**Diagnosis:**

```bash
# Check ETL logs
docker logs etl --tail=200

# Check last successful run
docker exec backend python -c "
from etl.kenya_pipeline import KenyaDataPipeline
p = KenyaDataPipeline()
print(p.get_last_run_status())
"

# Check database for recent data
docker exec postgres psql -U postgres -d audit_app -c \
  "SELECT MAX(updated_at) FROM documents;"
```

**Resolution:**

**Manual retry:**

```bash
# Run ETL manually
docker exec -it etl python -m etl.kenya_pipeline

# Or backfill specific date range
docker exec -it etl python -m etl.backfill \
  BACKFILL_YEAR_FROM=2023 BACKFILL_YEAR_TO=2024
```

**Fix common issues:**

```bash
# If source website changed structure
# 1. Update selectors in etl/resilient_scraper.py
# 2. Test with sample data
# 3. Re-deploy ETL service

# If rate limited
# 1. Check etl/resilient_scraper.py retry settings
# 2. Increase delay between requests
# 3. Verify source allows automated access

# If disk space full
df -h
docker system prune -a  # Clean up old images
rm -rf /tmp/etl_downloads/*
```

**Prevention:**

- Monitor ETL success rate
- Set up alerts for data freshness
- Document source website contacts

---

### 4. High Response Times

**Symptoms:**

- Alert: "SlowAPIResponses" or "SlowDatabaseQueries"
- Users report slow page loads
- p95 latency > 2 seconds

**Diagnosis:**

```bash
# Check API metrics
curl https://api.yourdomain.com/metrics | grep http_request_duration

# Check database query performance
docker exec postgres psql -U postgres -d audit_app -c \
  "SELECT query, calls, mean_exec_time, max_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 10;"

# Check system resources
docker stats
# or
kubectl top pods
```

**Resolution:**

**If database is slow:**

```sql
-- Add missing indexes
CREATE INDEX idx_documents_county ON documents(county_id);
CREATE INDEX idx_documents_year ON documents(fiscal_year);

-- Vacuum and analyze
VACUUM ANALYZE documents;
```

**If API is slow:**

```bash
# Check for slow endpoints in logs
grep "duration" main_backend.log | sort -k6 -n -r | head -20

# Increase worker count
# Edit docker-compose.yml: --workers 4
docker-compose up -d backend

# Enable caching for read-heavy endpoints
# Verify Redis is working
docker exec redis redis-cli ping
```

**Prevention:**

- Regular database maintenance (VACUUM, ANALYZE)
- Add indexes for common queries
- Implement query result caching
- Use database read replicas for heavy loads

---

### 5. Rate Limiting Issues

**Symptoms:**

- Users getting 429 Too Many Requests
- Alert: "HighRequestRate"
- Legitimate traffic being blocked

**Diagnosis:**

```bash
# Check rate limit logs
docker logs backend | grep "Rate limit exceeded"

# Check Redis rate limit keys
docker exec redis redis-cli --scan --pattern "rate_limit:*" | wc -l

# Identify top requesters
docker logs backend | grep "Rate limit" | awk '{print $NF}' | sort | uniq -c | sort -rn | head -10
```

**Resolution:**

**Temporarily increase limits:**

```bash
# Edit docker-compose.yml or deployment config
# Change: RATE_LIMIT_CALLS=200 (from 120)
docker-compose up -d backend
```

**Whitelist specific IPs:**

```python
# In backend/middleware/security.py, add:
WHITELISTED_IPS = ["1.2.3.4", "5.6.7.8"]  # Add trusted IPs

# Update dispatch method to skip whitelist
```

**Block malicious IPs:**

```bash
# At nginx/load balancer level
# Add to nginx.conf:
deny 1.2.3.4;

# Or use fail2ban
fail2ban-client set nginx-rate-limit banip 1.2.3.4
```

**Prevention:**

- Monitor rate limit metrics
- Use different limits for authenticated users
- Implement API keys for known clients
- Use CDN for static content

---

### 6. Redis Connection Failures

**Symptoms:**

- Alert: "RedisDown"
- Caching not working
- Rate limiting falls back to in-memory

**Diagnosis:**

```bash
# Check Redis status
docker ps | grep redis
redis-cli ping

# Check memory usage
redis-cli info memory

# Check connection count
redis-cli CLIENT LIST | wc -l
```

**Resolution:**

```bash
# Restart Redis
docker-compose restart redis

# If memory issues, flush cache
redis-cli FLUSHDB

# If persistence issues, check disk space
df -h
docker exec redis redis-cli BGSAVE
```

**Prevention:**

- Set maxmemory policy: `maxmemory-policy allkeys-lru`
- Monitor Redis memory usage
- Regular persistence snapshots

---

### 7. Security Incidents

**Symptoms:**

- Unusual traffic patterns
- Alert: "HighRequestRate" from single IP
- Suspicious authentication attempts

**Immediate Actions:**

1. **Isolate:**

   ```bash
   # Block suspicious IP at firewall level
   iptables -A INPUT -s MALICIOUS_IP -j DROP
   ```

2. **Investigate:**

   ```bash
   # Check logs for affected endpoints
   docker logs backend | grep "MALICIOUS_IP"

   # Check database for unauthorized access
   docker exec postgres psql -U postgres -d audit_app -c \
     "SELECT * FROM audit_log WHERE ip_address='MALICIOUS_IP';"
   ```

3. **Notify:**

   - Alert security team
   - Document incident
   - Prepare incident report

4. **Mitigate:**
   - Rotate exposed credentials
   - Patch vulnerabilities
   - Update security rules

---

## Deployment Procedures

### Standard Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Build new images
docker-compose -f docker-compose.prod.yml build

# 3. Run database migrations
docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# 4. Deploy with zero downtime
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify health
curl https://api.yourdomain.com/health

# 6. Monitor logs for errors
docker-compose logs -f --tail=50
```

### Rollback Procedure

```bash
# 1. Stop current deployment
docker-compose -f docker-compose.prod.yml down

# 2. Deploy previous version
docker-compose -f docker-compose.prod.yml up -d \
  -e BACKEND_IMAGE=audit-app-backend:v1.2.3 \
  -e FRONTEND_IMAGE=audit-app-frontend:v1.2.3

# 3. Rollback database if needed
docker exec backend alembic downgrade -1

# 4. Verify
curl https://api.yourdomain.com/health
```

---

## Monitoring Checklist

**Daily:**

- [ ] Check Sentry for new errors
- [ ] Review Grafana dashboards
- [ ] Verify ETL jobs succeeded
- [ ] Check disk space usage

**Weekly:**

- [ ] Review slow query log
- [ ] Analyze traffic patterns
- [ ] Check for security updates
- [ ] Test backup restoration

**Monthly:**

- [ ] Review and update runbook
- [ ] Conduct incident response drill
- [ ] Review capacity planning
- [ ] Update documentation

---

## Escalation Matrix

| Severity | Response Time     | Escalate To                    | Notify                  |
| -------- | ----------------- | ------------------------------ | ----------------------- |
| Critical | 15 minutes        | On-call engineer → DevOps Lead | Management, Status page |
| High     | 1 hour            | On-call engineer               | Team lead               |
| Medium   | 4 hours           | Team member                    | Team                    |
| Low      | Next business day | Team member                    | None                    |

---

## Useful Commands

```bash
# View all service logs
docker-compose logs -f

# Check database size
docker exec postgres psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('audit_app'));"

# Clear Redis cache
docker exec redis redis-cli FLUSHALL

# Export database backup
docker exec postgres pg_dump -U postgres audit_app > backup_$(date +%Y%m%d).sql

# Check system resources
docker stats --no-stream

# Test API authentication
curl -H "Authorization: Bearer $TOKEN" https://api.yourdomain.com/api/v1/counties

# View rate limit status
docker exec redis redis-cli --scan --pattern "rate_limit:*" | head -10

# Check celery workers (if using)
docker exec backend celery -A tasks inspect active
```

---

## Post-Incident Review Template

**Incident:** [Brief description]  
**Date:** [YYYY-MM-DD]  
**Duration:** [XX hours/minutes]  
**Severity:** [Critical/High/Medium/Low]

**Timeline:**

- HH:MM - Issue detected
- HH:MM - Team notified
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

**Root Cause:** [Technical explanation]

**Impact:**

- Users affected: [number/percentage]
- Services impacted: [list]
- Data loss: [Yes/No, details]

**Resolution:** [Steps taken]

**Action Items:**

1. [Preventive measure 1]
2. [Preventive measure 2]
3. [Documentation update]

**Lessons Learned:** [Key takeaways]
