export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body = await request.json();
    const { countryCode, vatNumber } = body || {};

    // Validate inputs
    if (!countryCode || !vatNumber) {
      return createErrorResponse(
        'Missing countryCode or vatNumber',
        400
      );
    }

    // Sanitize inputs
    const sanitizedCountryCode = String(countryCode).toUpperCase().trim();
    const sanitizedVatNumber = String(vatNumber).toUpperCase().trim().replace(/[^A-Z0-9]/g, '');

    // Validate country code format (2 letters)
    if (!/^[A-Z]{2}$/.test(sanitizedCountryCode)) {
      return createErrorResponse(
        'Invalid country code format (must be 2 letters)',
        400
      );
    }

    // Validate VAT number format (must contain digits)
    if (!/^[A-Z0-9]{5,}$/.test(sanitizedVatNumber)) {
      return createErrorResponse(
        'Invalid VAT number format',
        400
      );
    }

    // Call VIES API
    const viesResponse = await fetch(
      'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VAT-Checker/1.0'
        },
        body: JSON.stringify({
          countryCode: sanitizedCountryCode,
          vatNumber: sanitizedVatNumber
        })
      }
    );

    // Handle VIES API errors
    if (!viesResponse.ok) {
      console.error('VIES API Error:', viesResponse.status, viesResponse.statusText);
      return createErrorResponse(
        'VIES service temporarily unavailable. Please try again later.',
        503
      );
    }

    const viesData = await viesResponse.json();

    // Return the VIES response with CORS headers
    return new Response(
      JSON.stringify(viesData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      }
    );

  } catch (error) {
    console.error('Server error:', error);

    // Check if error is a JSON parsing error
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        'Invalid JSON in request body',
        400
      );
    }

    // Generic server error
    return createErrorResponse(
      'Internal server error. Please contact support.',
      500
    );
  }
};

/**
 * Helper function to create error responses with CORS headers
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} Formatted error response
 */
function createErrorResponse(message, status) {
  return new Response(
    JSON.stringify({
      error: message,
      status: status
    }),
    {
      status: status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}
