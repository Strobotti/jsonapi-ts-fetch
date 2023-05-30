# JSON:API fetch wrapper in Typescript

![cov](https://strobotti.github.io/jsonapi-ts-fetch/badges/coverage.svg)

A JSON:API response payload is a normalized set of entities and their relationships plus some metadata. This package
is a wrapper for fetching JSON:API resources and deserializing them into an object graph, using user-defined entity
deserializers to build the actual entities.

This package uses [jsonapi-ts-deserializer](https://github.com/strobotti/jsonapi-ts-deserializer) to deserialize the
JSON:API response payload. A `Fetch`-interface needs to be implemented to fetch the JSON:API resources. This way
the package can be used in any environment (browser, node, react-native, etc.) and the user can use any HTTP library
with any kind of authentication scenario necessary.

## Installation

```shell
npm i jsonapi-ts-fetch
```

## Usage

```typescript
import { Fetch, getDeserializer, ItemDeserializer, RelationshipDeserializer, GetParams } from 'jsonapi-ts-fetch';

// Introduce types for your entities, the folder:
type Folder = {
  id: number;
  name: string;
  children: (Folder | File)[];
}

// and the file:
type File = {
  id: number;
  name: string;
}

// Create a deserializer for the folder:
const folderDeserializer: ItemDeserializer<Folder> = {
  type: 'folders',
  deserialize: (item: Item, relationshipDeserializer: RelationshipDeserializer): Folder => {
    const folder: Folder = {
      id: parseInt(item.id),
      name: item.attributes.name,
      children: [],
    };

    folder.children = relationshipDeserializer.deserializeRelationships(relationshipDeserializer, item, 'children');

    return folder;
  },
}

// ...and also for the file:
const fileDeserializer: ItemDeserializer<File> = {
  type: 'files',
  deserialize: (item: Item, relationshipDeserializer: RelationshipDeserializer): File => {
    return {
      id: parseInt(item.id),
      name: item.attributes.name,
    };
  }
}

// create the deserializer with the folder and file deserializers registered:
const deserializer = getDeserializer([
  folderDeserializer,
  fileDeserializer,
]);

// create a fetcher:
export default function useFetch(): Fetch {
  return {
    get: request('GET'),
    post: request('POST'),
    put: request('PUT'),
    patch: request('PATCH'),
    delete: request('DELETE')
  };

  function request(method: string) {
    return (url: string, body?: unknown): Promise<Response> => {
      // here you can do whatever, setup Authorization-headers etc
      const requestOptions: RequestInit = {
        method,
      };

      const headers = new Headers({
        // here you can do whatever, setup Authorization-headers etc
      });

      // assuming jsonable data
      headers.set('Content-Type', 'application/json');
      requestOptions.body = JSON.stringify(body);

      requestOptions.headers = headers

      return fetch(url, requestOptions)
    }
  }
}

// use the JsonapiFetcher:
const jsonApiFetch: JsonApiFetch<Folder> = useJsonApiFetch(fetch, '/api/v1/folders', deserializer);

// Filter by your heart's content:
const params: GetParams = {
  sort: ['-name'],
  page:  1,
  limit: 10,
  filter: {
    name: 'foo',
  },
};

jsonApiFetch.find(params, ['files']).then((response: JsonApiResponse<Folder>) => {
  // ...do your thing
});
```
