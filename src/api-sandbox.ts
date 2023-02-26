import { hostname } from 'os'
import { createSiteConnection } from './'

const connection = createSiteConnection({
  username: 'tim',
  password: 'pswd',
  siteUrl: 'my.sharepoint.com/path/to/my/site',
  protocol: 'https',
  domain: 'domain.com',
  hostname: hostname(),
})

async function getMyList(listName: string) {
  const token = await connection.getAuthToken()
  const contents = await connection.getListContents(token, listName)
  return contents
}

const listContents = getMyList('myList')
