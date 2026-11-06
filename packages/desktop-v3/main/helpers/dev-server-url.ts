const DEV_SERVER_ORIGIN = 'http://localhost'
const DEV_SERVER_PORT_PATTERN = /^[0-9]{1,5}$/
const MIN_PORT = 1
const MAX_PORT = 65535

/**
 * Parses the renderer dev-server port that nextron hands to the main process
 * as a command line argument (`electron . <port> [options]`).
 *
 * Command line arguments can be controlled by everything that is able to
 * launch the application, so the value is strictly validated. Only plain
 * decimal numbers inside the valid port range are accepted.
 */
export const parseDevServerPort = (rawPort: string | undefined): number => {
  const port = Number.parseInt(rawPort ?? '', 10)

  if (
    rawPort === undefined ||
    !DEV_SERVER_PORT_PATTERN.test(rawPort) ||
    !Number.isInteger(port) ||
    port < MIN_PORT ||
    port > MAX_PORT
  ) {
    throw new Error(`Invalid renderer dev-server port: ${rawPort}`)
  }

  return port
}

/**
 * Builds the URL of the renderer dev-server.
 *
 * The origin is a constant and the port is a validated number, so no
 * unvalidated input can end up influencing the target of the request.
 */
export const buildDevServerUrl = (rawPort: string | undefined): URL => {
  const url = new URL(DEV_SERVER_ORIGIN)
  url.port = String(parseDevServerPort(rawPort))
  url.pathname = '/home'

  return url
}
