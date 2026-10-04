# Upload API

A Lambda function behind API Gateway.

- Writes the original photo to the [photos bucket](#photos) and a row to the [photo index](#table).
- Returns in under 200 ms; thumbnails are made later by the [resizer](#resizer).
- Logs and metrics go to [CloudWatch](#logs).
