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
    - [createConnection](#createConnection)
      - [Options](#options)
    - [getListContents](#getListContents)
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
$ npm i sp-rest-connect
```

Or if you prefer using Yarn:

```sh
$ yarn add --dev sp-rest-connect
```

## Usage

To be determined.

## API

### createConnection

```js
const connection = createConnection(options: Options);
```

#### Options

`username`

| Type   | Description         |
| ------ | ------------------- |
| string | SharePoint username |

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

### getListContents

```ts
const response = await connection.getListContents(listName: string)
const result = response.sucess ? response.data : response.error
```

`listName`

| Type   | Description          |
| ------ | -------------------- |
| string | SharePoint list name |

## Contributing

This is a pet project to save me time at work. It is still under development and not ready for use.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/your/project/tags).

## Authors

- **B Jones RFD** - _Package Noob_ - [B-Jones-RFD](https://github.com/B-Jones-RFD)

## License

[MIT License](https://github.com/B-Jones-RFD/sp-rest-connect/blob/main/LICENSE)
