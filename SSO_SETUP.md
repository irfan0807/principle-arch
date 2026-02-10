# FoodDash SSO Setup Guide

This guide explains how to set up Single Sign-On (SSO) for FoodDash using Keycloak, a free and open-source identity and access management solution.

## Prerequisites

- Docker and Docker Compose
- Node.js and npm (for the FoodDash application)

## Quick Start

### 1. Start Keycloak

```bash
# Start Keycloak with PostgreSQL database
docker-compose -f docker-compose.keycloak.yml up -d

# Wait for Keycloak to be ready (check logs)
docker-compose -f docker-compose.keycloak.yml logs -f keycloak
```

### 2. Access Keycloak Admin Console

- URL: http://localhost:8080
- Username: `admin`
- Password: `admin123`

### 3. Create FoodDash Realm

1. Click on the dropdown in the top-left corner (shows "Master")
2. Click "Create realm"
3. Set Name to `fooddash`
4. Click "Create"

### 4. Create FoodDash Client

1. In the left sidebar, click "Clients"
2. Click "Create client"
3. Configure the client:
   - **Client ID**: `fooddash-client`
   - **Client Type**: `OpenID Connect`
   - **Client authentication**: `On`
4. Click "Next"
5. Configure authentication flow:
   - **Standard flow**: Enabled
   - **Direct access grants**: Enabled
6. Click "Next"
7. Configure login settings:
   - **Valid redirect URIs**: `http://localhost:5000/api/auth/keycloak/callback`
   - **Web origins**: `http://localhost:5000`
8. Click "Save"

### 5. Get Client Secret

1. Go to the "Credentials" tab of the fooddash-client
2. Copy the "Client secret" value

### 6. Configure Environment Variables

Add these environment variables to your `.env` file:

```bash
# Keycloak Configuration
KEYCLOAK_AUTH_SERVER_URL=http://localhost:8080
KEYCLOAK_REALM=fooddash
KEYCLOAK_CLIENT_ID=fooddash-client
KEYCLOAK_CLIENT_SECRET=your-client-secret-here
APP_URL=http://localhost:5000
```

### 7. Start FoodDash Application

```bash
npm run dev
```

### 8. Test SSO Login

1. Go to http://localhost:5173/sign-in
2. Click on the "SSO" tab
3. Click "Continue with SSO"
4. You should be redirected to Keycloak login page
5. Create a user or use existing admin credentials

## Manual Keycloak Setup (Alternative)

If you prefer to set up Keycloak manually without Docker:

### 1. Download and Install Keycloak

```bash
# Download Keycloak
wget https://github.com/keycloak/keycloak/releases/download/22.0.0/keycloak-22.0.0.zip
unzip keycloak-22.0.0.zip
cd keycloak-22.0.0

# Start Keycloak in development mode
./bin/kc.sh start-dev
```

### 2. Follow steps 2-8 from Quick Start above

## Production Deployment

For production deployment, consider:

### 1. Use a production database (PostgreSQL/MySQL)
### 2. Configure HTTPS
### 3. Set up proper hostname
### 4. Configure email/SMS for user registration
### 5. Set up user federation (LDAP, Active Directory, etc.)
### 6. Configure proper session management
### 7. Set up monitoring and logging

### Production Environment Variables

```bash
KEYCLOAK_AUTH_SERVER_URL=https://your-keycloak-domain.com
KEYCLOAK_REALM=fooddash
KEYCLOAK_CLIENT_ID=fooddash-client
KEYCLOAK_CLIENT_SECRET=your-production-client-secret
APP_URL=https://your-app-domain.com
```

## Keycloak Features Used

- **OpenID Connect**: Standard protocol for SSO
- **Realm**: Isolated authentication domain
- **Client**: Application that can request authentication
- **Users**: Identity management
- **Roles**: Authorization management
- **Groups**: User organization

## Troubleshooting

### Common Issues

1. **"Client not found" error**
   - Check that the realm name matches exactly
   - Verify client ID is correct

2. **"Invalid redirect URI" error**
   - Ensure redirect URIs are configured correctly in Keycloak client settings

3. **Connection refused**
   - Make sure Keycloak is running and accessible
   - Check firewall settings

4. **CORS errors**
   - Configure Web origins in Keycloak client settings

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=keycloak:*
```

## Security Considerations

- Change default admin credentials in production
- Use strong client secrets
- Configure proper CORS policies
- Enable HTTPS in production
- Regularly update Keycloak to latest version
- Implement proper session management
- Configure rate limiting

## Additional Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OpenID Connect Specification](https://openid.net/connect/)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/rfc6749)