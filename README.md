# EVE OAuth2 Token Proxy

This Node.js application acts as a lightweight OAuth2 proxy for EVE Online, enabling secure authentication and token management.

## What It Does

- Redirects users to EVE Online's OAuth2 login (`/auth/login`)
- Handles the callback after successful login (`/auth/callback`)
- Exchanges the authorization code for access and refresh tokens
- Verifies the authenticated character's identity using the access token
- Stores the token securely in Google Secret Manager, using the format:
