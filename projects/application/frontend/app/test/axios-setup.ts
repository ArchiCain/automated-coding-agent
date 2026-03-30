import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'

// Create a global cookie jar to handle cookies like a browser
// All axios instances will share this jar, simulating a browser's cookie storage
const jar = new CookieJar()

// Wrap axios globally to enable automatic cookie handling
// This patches axios.create() so all new instances also get cookie support
wrapper(axios)

// Force axios to use Node.js adapter in tests instead of XMLHttpRequest
// @ts-ignore
axios.defaults.adapter = 'http'

// Configure global axios defaults
// @ts-ignore
axios.defaults.jar = jar
axios.defaults.withCredentials = true

// Patch axios.create to ensure all instances use the shared cookie jar
const originalCreate = axios.create
axios.create = function(config?: any) {
  const instance = originalCreate.call(axios, config)
  // @ts-ignore
  instance.defaults.jar = jar
  // @ts-ignore
  instance.defaults.adapter = 'http'
  return instance
}

console.log('Axios configured to use Node.js HTTP adapter with cookie support')
