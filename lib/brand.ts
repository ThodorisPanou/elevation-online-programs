// lib/brand.ts
// The app's name, in one place. Coaches are never the brand: a coach's name shows only where it means "your coach"
// ("Coached by …"). Changing these needs a deploy; phones that already added the app to their home screen keep the
// old short name until they add it again.

export const APP_NAME        = 'Elevation Performance Online Programs'
export const APP_SHORT_NAME  = 'Elevation'   // under the home-screen icon (iPhone fits ~12 characters) and page marks
export const APP_DESCRIPTION = 'Training programs by Elevation Performance'

// Who built the app: a quiet "Built by …" line under the athlete pages' footer and the login page
export const CREDIT_NAME = 'Thodoris Panou'
export const CREDIT_URL  = 'https://www.linkedin.com/in/thodoris-panou-13186320b'
