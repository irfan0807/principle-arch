import Keycloak from 'keycloak-connect';
import { Request, Response, NextFunction } from 'express';

// Keycloak configuration
const keycloakConfig = {
  'auth-server-url': process.env.KEYCLOAK_AUTH_SERVER_URL || 'http://localhost:8080',
  'realm': process.env.KEYCLOAK_REALM || 'fooddash',
  'resource': process.env.KEYCLOAK_CLIENT_ID || 'fooddash-client',
  'public-client': true,
  'confidential-port': 0,
  'ssl-required': process.env.NODE_ENV === 'production' ? 'external' : 'none',
  'use-resource-role-mappings': true,
  'cors': true,
  'cors-max-age': 1000,
  'cors-allowed-methods': 'POST, PUT, DELETE, GET',
  'cors-allowed-headers': 'X-Requested-With, Content-Type, Authorization, Origin, Accept, Access-Control-Request-Method, Access-Control-Request-Headers',
  'enable-cors': true,
  'expose-token': true,
  'bearer-only': false,
  'autodetect-bearer-only': false,
  'connection-pool-size': 20,
  'disable-trust-manager': false,
  'allow-any-hostname': true,
  'truststore': undefined,
  'truststore-password': undefined,
  'client-keystore': undefined,
  'client-keystore-password': undefined,
  'client-key-password': undefined,
  'token-store': 'session',
  'principal-attribute': 'preferred_username',
  'proxy-url': undefined,
  'redirect-rewrite-rules': {},
  'enable-basic-auth': false,
  'enable-oauth2-bearer': true,
  'always-refresh-token': false,
  'register-node-at-startup': false,
  'register-node-period': 600,
  'token-minimum-time-to-live': 10,
  'min-time-between-jwks-requests': 10,
  'public-key-cache-ttl': 86400,
  'policy-enforcer': {},
  'credentials': {
    'secret': process.env.KEYCLOAK_CLIENT_SECRET || ''
  }
};

// Initialize Keycloak
let keycloak: Keycloak.Keycloak;

export function initializeKeycloak(app: any) {
  // Initialize Keycloak with memory store (use Redis in production)
  const memoryStore = new (require('express-session').MemoryStore)();

  keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

  // Install the Keycloak middleware
  app.use(keycloak.middleware({
    logout: '/api/auth/logout',
    admin: '/',
  }));

  return keycloak;
}

export function getKeycloak() {
  if (!keycloak) {
    throw new Error('Keycloak not initialized. Call initializeKeycloak first.');
  }
  return keycloak;
}

// Middleware to protect routes
export const keycloakProtect = (role?: string) => {
  return keycloak.protect(role);
};

// Middleware to get user info from token
export const getUserFromToken = (req: Request, res: Response, next: NextFunction) => {
  if (req.kauth && req.kauth.grant && req.kauth.grant.access_token) {
    const token = req.kauth.grant.access_token;
    req.user = {
      id: token.content.sub,
      email: token.content.email,
      firstName: token.content.given_name,
      lastName: token.content.family_name,
      preferredUsername: token.content.preferred_username,
      roles: token.content.realm_access?.roles || [],
      token: token.token
    };
  }
  next();
};

// SSO login URL generator
export const getSSOLoginUrl = (redirectUri?: string) => {
  const baseUrl = `${keycloakConfig['auth-server-url']}/realms/${keycloakConfig.realm}/protocol/openid-connect/auth`;
  const params = new URLSearchParams({
    client_id: keycloakConfig.resource,
    redirect_uri: redirectUri || `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/keycloak/callback`,
    response_type: 'code',
    scope: 'openid profile email',
    state: Math.random().toString(36).substring(7)
  });
  return `${baseUrl}?${params.toString()}`;
};

// SSO logout URL generator
export const getSSOLogoutUrl = (redirectUri?: string) => {
  const baseUrl = `${keycloakConfig['auth-server-url']}/realms/${keycloakConfig.realm}/protocol/openid-connect/logout`;
  const params = new URLSearchParams({
    redirect_uri: redirectUri || `${process.env.APP_URL || 'http://localhost:5000'}/`
  });
  return `${baseUrl}?${params.toString()}`;
};