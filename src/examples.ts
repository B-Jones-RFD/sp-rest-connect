import { hostname } from 'os'
import { createSiteConnection, getListContents } from '.'

const connectionOpts = {
  username: 'tim',
  password: 'pswd',
  site: 'my.sharepoint.com',
  serverRelativeUrl: '/path/to/my/site',
  protocol: 'https' as const,
  domain: 'domain.com',
  hostname: hostname(),
}

const connection = createSiteConnection(connectionOpts)

const params = new URLSearchParams({
  $select: 'Id',
  $top: '200',
})

// Using instance methods
async function getMyList(listName: string) {
  const contents = await connection.getListContents({ listName, params })
  if (contents.success) return contents.data
  else throw new Error(contents.error)
}

// Using factory method
async function getMyListAlt(listName: string) {
  const action = getListContents(connectionOpts)
  const contents = await action({ listName, params })
  if (contents.success) return contents.data
  else throw new Error(contents.error)
}

const myListContents = getMyList('myList')
const yourListContents = getMyListAlt('yourList')
