import { Deserializer } from 'jsonapi-ts-deserializer';

/**
 * Implement this interface to add API-specific stuff (such as authentication) to the fetch calls.
 */
export interface Fetch {
  get(url: string): Promise<Response>;
  post(url: string, data: unknown): Promise<Response>;
  put(url: string, data: unknown): Promise<Response>;
  patch(url: string, data: unknown): Promise<Response>;
  delete(url: string): Promise<Response>;
}

export type JsonApiAttributes = {
  [key: string]: unknown;
};

export type JsonApiItem = {
  type: string;
  id: string | null;
  attributes?: JsonApiAttributes;
  relationships?: {
    [key: string]: unknown;
  };
};

export type GetParams = {
  sort?: string[];
  page?: number | null;
  limit?: number | null;
  filters?: {
    [key: string]: unknown;
  };
};

export type JsonApiResponse<T> = {
  data: T | T[];
  links?: {
    [key: string]: unknown;
  };
  meta?: {
    [key: string]: unknown;
  };
};

export interface JsonApiFetch<T> {
  find: (filters: GetParams, includes: string[]) => Promise<JsonApiResponse<T>>;
  findOne: (id: string, includes: string[]) => Promise<JsonApiResponse<T>>;
  updateOne: (entity: T, includes: string[]) => Promise<JsonApiResponse<T>>;
  createOne: (entity: T, includes: string[]) => Promise<JsonApiResponse<T>>;
  deleteOne: (id: string) => Promise<void>;
}

export type EntitySerializer<T> = {
  serialize: (entity: T) => JsonApiItem;
};

/**
 * A generic service for interacting with a JSON:API endpoint
 *
 * @param fetch
 * @param route
 * @param deserializer
 * @param serializer
 */
export default function useJsonApiFetch<T>(
  fetch: Fetch,
  route: string,
  deserializer: Deserializer,
  serializer?: EntitySerializer<T>,
): JsonApiFetch<T> {
  function consumeRootItem(data: any): JsonApiResponse<T> {
    const rootItem: T = deserializer.consume(data).getRootItem();
    const response: JsonApiResponse<T> = {
      data: rootItem,
    };

    if (data.links !== undefined) response.links = data.links;
    if (data.meta !== undefined) response.meta = data.meta;

    return response;
  }

  return {
    find: (params: GetParams, includes: string[]): Promise<JsonApiResponse<T>> => {
      const paramsArray: string[] = [];

      if (params.filters !== undefined) {
        const filters = params.filters;

        Object.keys(filters).forEach((key: string) => {
          const val = filters[key];
          paramsArray.push(`filter[${key}]=${val}`);
        });
      }
      if (params.page !== undefined && params.page !== null) {
        paramsArray.push(`page[number]=${params.page}`);
      }
      if (params.limit) {
        paramsArray.push(`page[size]=${params.limit}`);
      }
      if (params.sort !== undefined) {
        paramsArray.push(`sort=` + encodeURIComponent(params.sort.join(',')));
      }
      if (includes.length > 0) {
        paramsArray.push(`include=` + encodeURIComponent(includes.join(',')));
      }

      const url = route + '?' + paramsArray.join('&');

      return fetch
        .get(url)
        .then((response: Response) => {
          return response.json();
        })
        .then((data) => {
          const rootItems: T[] = deserializer.consume(data).getRootItems();
          const response: JsonApiResponse<T> = {
            data: rootItems,
          };

          if (data.links !== undefined) response.links = data.links;
          if (data.meta !== undefined) response.meta = data.meta;

          return response;
        });
    },

    findOne: (id: string, includes: string[]): Promise<JsonApiResponse<T>> => {
      const url = route + '/' + id + (includes.length > 0 ? '?include=' + includes.join(',') : '');

      return fetch
        .get(url)
        .then((response: Response) => {
          return response.json();
        })
        .then((data) => {
          return consumeRootItem(data);
        });
    },

    updateOne: (entity: T, includes: string[]): Promise<JsonApiResponse<T>> => {
      if (serializer === undefined) {
        throw new Error('Serializer is required for updateOne');
      }

      const item = serializer.serialize(entity);
      const url = route + '/' + item.id + (includes.length > 0 ? '?include=' + includes.join(',') : '');

      return fetch
        .patch(url, { data: item })
        .then((response: Response) => {
          return response.json();
        })
        .then((data) => {
          return consumeRootItem(data);
        });
    },

    createOne: (entity: T, includes: string[]): Promise<JsonApiResponse<T>> => {
      if (serializer === undefined) {
        throw new Error('Serializer is required for createOne');
      }

      const item = serializer.serialize(entity);
      const url = route + (includes.length > 0 ? '?include=' + includes.join(',') : '');

      return fetch
        .post(url, { data: item })
        .then((response: Response) => {
          return response.json();
        })
        .then((data) => {
          return consumeRootItem(data);
        });
    },

    deleteOne: (id: string): Promise<void> => {
      const url = route + '/' + id;

      return fetch.delete(url).then((response: Response) => {
        if (!response.ok) {
          throw new Error('Entity could not be deleted');
        }
      });
    },
  };
}
