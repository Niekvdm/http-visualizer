// Funny loading texts for the fetching phase
export const fetchingTexts: string[] = [
  'Hacking the mainframe...',
  'Bypassing the firewall...',
  'Injecting SQL... just kidding',
  'Asking the server nicely...',
  'Bribing the load balancer...',
  'Consulting the Oracle database...',
  'Negotiating with the API...',
  'Convincing the server we\'re friends...',
  'Sending carrier pigeons...',
  'Warming up the tubes...',
  'Greasing the gears...',
  'Spinning up hamster wheels...',
  'Defragmenting the cloud...',
  'Reticulating splines...',
  'Compiling the internet...',
  'Downloading more RAM...',
  'Reversing the polarity...',
  'Calibrating flux capacitor...',
  'Engaging warp drive...',
  'Summoning the data spirits...',
  'Performing arcane rituals...',
  'Bribing the DNS gods...',
  'Untangling the spaghetti code...',
  'Poking the server with a stick...',
  'Sacrificing a semicolon...',
  'Appeasing the cache demons...',
  'Whispering to the packets...',
  'Tickling the endpoints...',
  'Massaging the JSON...',
  'Fluffing the response...',
]

// Texts for authentication phase
export const authTexts: string[] = [
  'Verifying identity...',
  'Checking credentials...',
  'Authenticating user...',
  'Validating tokens...',
  'Handshaking with server...',
  'Proving we\'re not a robot...',
  'Decoding secret handshake...',
  'Entering the matrix...',
  'Unlocking the vault...',
  'Obtaining clearance...',
  'Generating access codes...',
  'Bypassing security...',
  'Cracking the cipher...',
  'Establishing trust...',
  'Exchanging secrets...',
]

// Texts for OAuth authorization phase (user login)
export const authorizingTexts: string[] = [
  'Awaiting your login...',
  'Complete the sign-in below...',
  'Waiting for authorization...',
  'Sign in to continue...',
  'Authenticate to proceed...',
  'Your credentials, please...',
  'Access portal opened...',
  'Identity verification required...',
  'Waiting for your approval...',
  'Login to unlock the API...',
  'OAuth dance in progress...',
  'Redirect intercepted...',
  'Token exchange pending...',
]

// Success messages
export const successTexts: string[] = [
  'Mission accomplished!',
  'Data retrieved successfully!',
  'The server has spoken!',
  'Connection established!',
  'Payload delivered!',
  'Target acquired!',
  'Operation complete!',
  'Access granted!',
  'Data stream captured!',
  'Response intercepted!',
]

// Error messages
export const errorTexts: string[] = [
  'Houston, we have a problem...',
  'The server has rejected us!',
  'Connection terminated!',
  'Access denied!',
  'Something went wrong...',
  'The matrix has glitched!',
  'Critical failure detected!',
  'Abort! Abort! Abort!',
  'System malfunction!',
  'Error in the mainframe!',
]

export function getRandomText(texts: string[]): string {
  return texts[Math.floor(Math.random() * texts.length)]
}

export function getRandomFetchingText(): string {
  return getRandomText(fetchingTexts)
}

export function getRandomAuthText(): string {
  return getRandomText(authTexts)
}

export function getRandomAuthorizingText(): string {
  return getRandomText(authorizingTexts)
}

export function getRandomSuccessText(): string {
  return getRandomText(successTexts)
}

export function getRandomErrorText(): string {
  return getRandomText(errorTexts)
}

