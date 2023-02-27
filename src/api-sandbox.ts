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
  const contents = await connection.getListContents(listName)
  if (contents.success) return contents.data
  else throw new Error(contents.error)
}

const listContents = getMyList('myList')
