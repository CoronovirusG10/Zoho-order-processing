# E2E Test Results

**Execution Time**: 2025-12-30 00:03:05

---

## 4.1 Workflow Trigger Test

**Timestamp**: 2025-12-30 00:03:05

**Command**: `curl -s -X POST http://localhost:3005/api/workflows/test -H 'Content-Type: application/json' -d '{"test": true}'`

**Raw Response**:
```json
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot POST /api/workflows/test</pre>
</body>
</html>
```

**Workflow ID**: Not found in response
**Result**: **WARN** - Response structure does not contain workflowId

---

## 4.2 Bot Message Processing Test

**Timestamp**: 2025-12-30 00:03:30

**Command**: `curl -s -X POST http://localhost:3978/api/messages -H 'Content-Type: application/json' -d '{"type": "message", "text": "test"}'`

**HTTP Status Code**: 401

**Raw Response**:
```
Unauthorized Access. Request is not authorized
```

**Result**: **WARN** - Bot endpoint reachable but requires authentication (expected for Teams bot)

---

## 4.3 API Temporal Connectivity Test

**Timestamp**: 2025-12-30 00:03:57

**Command**: `curl -s http://localhost:3005/api/temporal/status`

**HTTP Status Code**: 404

**Raw Response**:
```json
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /api/temporal/status</pre>
</body>
</html>
```

**Result**: **WARN** - Endpoint not implemented (404)

---

## Summary

**Summary Generated**: 2025-12-30 00:04:25

### Test Results

| Test | Description | Result |
|------|-------------|--------|
| 4.1 | Workflow Trigger | WARN |
| 4.2 | Bot Message Processing | WARN |
| 4.3 | API Temporal Connectivity | WARN |

### Totals

- **PASS**: 0
- **FAIL**: 0
- **WARN**: 3

### Workflow ID

- **Obtained**: No (response structure did not contain workflowId)

