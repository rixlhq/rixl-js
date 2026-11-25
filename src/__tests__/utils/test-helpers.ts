/**
 * Reusable test utilities and helpers
 * Following DRY principles - every helper is atomic and reusable
 */

/**
 * Creates a JWT token for testing
 */
export const createMockJWT = (payload: Record<string, any> = {}): string => {
  const header = btoa(JSON.stringify({alg: "HS256", typ: "JWT"}));
  const body = btoa(
    JSON.stringify({
      id: "user123",
      first_name: "Test",
      last_name: "User",
      username: "testuser",
      image_url: "https://example.com/image.jpg",
      language_code: "en",
      org_id: "org123",
      sign_in_id: "sign-in-test",
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    })
  );
  const signature = btoa("mock-signature");
  return `${header}.${body}.${signature}`;
};

/**
 * Creates a mock user object
 */
export const createMockUser = (overrides = {}) => ({
  id: "user123",
  first_name: "Test",
  last_name: "User",
  username: "testuser",
  image_url: "https://example.com/image.jpg",
  language_code: "en",
  email: "olalekan.akande@rixl.com",
  ...overrides,
});
