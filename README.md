[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

# sp-rest-connect

Use SharePoint Rest Services to interact with lists and document libraries. I got tired of rewriting these for work projects. Still building and not ready for use.

## Prerequisites

This project requires NodeJS (version 16) and NPM.
[Node](http://nodejs.org/) and [NPM](https://npmjs.org/) are really easy to install.
To make sure you have them available on your machine,
try running the following command.

```sh
$ npm -v && node -v
9.5.0
v16.19.1
```

[PNPM] (https://pnpm.io/) is a awesome alternative to NPM and is recommended.

## Table of contents

- [SP REST Connect](#sp-rest-connect)
  - [Prerequisites](#prerequisites)
  - [Table of contents](#table-of-contents)
  - [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Usage](#usage)
  - [API](#api)
    - [createSiteConnection](#createSiteConnection)
    - [Actions](#actions)
    - [Responses](#responses)
  - [Contributing](#contributing)
  - [Versioning](#versioning)
  - [Authors](#authors)
  - [License](#license)

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

## Installation

**BEFORE YOU INSTALL:** please read the [prerequisites](#prerequisites)

To install and set up the library, run:

```sh
$ npm i @b-jones-rfd/sp-rest-connect
```

Or if you prefer using Yarn:

```sh
$ yarn add @b-jones-rfd/sp-rest-connect
```

Or for PNPM:

```sh
$ pnpm add @b-jones-rfd/sp-rest-connect
```

## Usage

### Instance Methods

Actions can be performed against site collection lists or document libraries using instance methods on a SiteCollection instance.

```ts
import { createSiteConnection } from '@b-jones-rfd/sp-rest-connect'

const siteConnectionOptions = {
  username: 'tim',
  password: 'myexceptionalsecurepassword',
  site: 'my.sharepoint.com',
  serverRelativeUrl: '/path/to/my/site',
  protocol: 'https' as const,
}

const connection: SiteConnection = createSiteConnection(siteConnectionOptions)

const params = new URLSearchParams({
  $select: 'Id,Title',
  $top: '200',
})

async function getMyListUsingConnection(listName: string) {
  const contents = await connection.getListContents({ listName, params })
  if (contents.success) return contents.data
  else throw new Error(contents.error)
}
```

### Factory Action Methods

Additionally, for single use or reduced import size, action factory methods can be imported directly. Call the factory method with a SiteConnectionOptions object to return an asynchronous action function that can be called directly.

```ts
import { getListContents } from '@b-jones-rfd/sp-rest-connect'

async function getMyListUsingAction(listName: string) {
  const action = getListContents(connectionOpts)
  const contents = await action({ listName, params })
  if (contents.success) return contents.data
  else throw new Error(contents.error)
}
```

## API

### createSiteConnection

#### SiteConnectionOptions

`username`

| Type   | Description         | Example |
| ------ | ------------------- | ------- |
| string | SharePoint username | 'user'  |

`password`

| Type   | Description         |
| ------ | ------------------- |
| string | SharePoint password |

`site`

| Type   | Description       | Example               |
| ------ | ----------------- | --------------------- |
| string | SharePoint domain | sharepoint.domain.com |

`serverRelativeUrl`

| Type   | Description                  | Example          |
| ------ | ---------------------------- | ---------------- |
| string | SharePoint site relative Url | /path/to/my/site |

`protocol`

| Type   | Default value | Options          | Description   |
| ------ | ------------- | ---------------- | ------------- |
| string | 'https'       | 'http' or 'http' | Site protocol |

`domain`

| Type   | Default value | Description |
| ------ | ------------- | ----------- |
| string | ''            | NTLM domain |

`hostname`

| Type   | Default value | Description |
| ------ | ------------- | ----------- |
| string | os.hostname() | OS Hostname |

### Actions

SiteConnection instance action methods.

```ts
export type Action<TConfig, TResponse> = (
  options: TConfig
) => Promise<Result<TResponse>>
```

If using the actions directly call the factory method with a SiteConnectionOptions object to return an action that can be used to execute a SharePoint action.

#### addAttachmentToListItem(options)

`options`

| Property    | Type   | Description             | Required |
| ----------- | ------ | ----------------------- | -------- |
| accessToken | string | SharePoint access token | Y        |
| listName    | string | SharePoint list name    | Y        |
| spId        | number | SharePoint list item ID | Y        |
| fileName    | string | File name               | Y        |
| payload     | Buffer | File contents           | Y        |

#### addDocumentToLibrary(options)

`options`

| Property    | Type   | Description             | Required |
| ----------- | ------ | ----------------------- | -------- |
| accessToken | string | SharePoint access token | Y        |
| folder      | string | SharePoint folder name  | Y        |
| fileName    | string | File name               | Y        |
| payload     | Buffer | File contents           | Y        |

#### addListItem(options)

`options`

| Property    | Type   | Description              | Required |
| ----------- | ------ | ------------------------ | -------- |
| accessToken | string | SharePoint access token  | Y        |
| listName    | string | SharePoint list name     | Y        |
| payload     | string | List item JSON as string | Y        |

#### deleteDocumentFromLibrary(options)

`options`

| Property    | Type   | Description             | Required |
| ----------- | ------ | ----------------------- | -------- |
| accessToken | string | SharePoint access token | Y        |
| folder      | string | SharePoint folder name  | Y        |
| fileName    | string | File name               | Y        |

#### deleteListItem(options)

`options`

| Property    | Type   | Description             | Required |
| ----------- | ------ | ----------------------- | -------- |
| accessToken | string | SharePoint access token | Y        |
| listName    | string | SharePoint list name    | Y        |
| spId        | number | SharePoint list item ID | Y        |

#### getAuthToken()

#### getDocumentFromLibrary(options)

`options`

| Property | Type   | Description            | Required |
| -------- | ------ | ---------------------- | -------- |
| folder   | string | SharePoint folder name | Y        |
| fileName | string | File name              | Y        |

#### getListContents(options)

`options`

| Property | Type            | Description          | Required |
| -------- | --------------- | -------------------- | -------- |
| listName | string          | SharePoint list name | Y        |
| params   | UrlSearchParams | SharePoint list name | N        |

#### getListItem(options)

`options`

| Property | Type   | Description             | Required |
| -------- | ------ | ----------------------- | -------- |
| listName | string | SharePoint list name    | Y        |
| spId     | number | SharePoint list item ID | Y        |

#### getListItemType(options)

`options`

| Property | Type   | Description          | Required |
| -------- | ------ | -------------------- | -------- |
| listName | string | SharePoint list name | Y        |

#### updateListItem(options)

`options`

| Property    | Type   | Description                      | Required |
| ----------- | ------ | -------------------------------- | -------- |
| accessToken | string | SharePoint access token          | Y        |
| listName    | string | SharePoint list name             | Y        |
| spId        | number | SharePoint list item ID          | Y        |
| patch       | string | Updated list item JSON as string | Y        |

## Responses

Responses are provided based on the Result type. Success can be determined by checking the success property.

```ts
export type Result<TResponse> = Success<TResponse> | Failure
```

### Success

Response is returned in the data property.

```ts
type Success<TResponse> = { success: true; data: TResponse }
```

### Failure

Errors are returned in the error property.

```ts
type Failure = { success: false; error: string }
```

## Contributing

This is a pet project to save me time at work. It is still under development and not ready for use.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/B-Jones-RFD/sp-rest-connect/tags).

## Authors

- **B Jones RFD** - _Package Noob_ - [B-Jones-RFD](https://github.com/B-Jones-RFD)

## License

[MIT License](https://github.com/B-Jones-RFD/sp-rest-connect/blob/main/LICENSE)
