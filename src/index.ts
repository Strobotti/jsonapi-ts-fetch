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
    [key: string]: any;
  };
};

export type GetParams = {
  sort?: string[];
  page?: number | null;
  limit?: number | null;
  filters?: {
    [key: string]: any;
  };
  fields?: {
    [key: string]: string[];
  };
};

export type JsonApiResponse<T> = {
  data: T | T[];
  links?: {
    [key: string]: string | null;
  };
  meta?: {
    [key: string]: any;
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

export const buildRequestUrl = (route: string, params: GetParams, includes: string[]): string => {
  const paramsArray: string[] = [];

  if (params.filters !== undefined) {
    const filters = params.filters;

    Object.keys(filters).forEach((key: string) => {
      const val = filters[key] as string;
      paramsArray.push(`filter[${key}]=${val}`);
    });
  }
  if (params.fields !== undefined) {
    const fields = params.fields;

    Object.keys(fields).forEach((key: string) => {
      const val = encodeURIComponent(fields[key].join(','));
      paramsArray.push(`fields[${key}]=${val}`);
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

  if (paramsArray.length === 0) {
    return route;
  }

  return route + '?' + paramsArray.join('&');
};

/**
 * Instantiate a generic service for interacting with a JSON:API endpoint
 *
 * @param fetch
 * @param route
 * @param deserializer
 * @param serializer
 */
export const getJsonApiFetch = <T>(
  fetch: Fetch,
  route: string,
  deserializer: Deserializer,
  serializer?: EntitySerializer<T>,
): JsonApiFetch<T> => {
  const consumeRootItem = (data: any): JsonApiResponse<T> => {
    const rootItem: T = deserializer.consume(data).getRootItem();
    const response: JsonApiResponse<T> = {
      data: rootItem,
    };

    if (data.links !== undefined) response.links = data.links;
    if (data.meta !== undefined) response.meta = data.meta;

    return response;
  };

  return {
    find: (params: GetParams, includes: string[]): Promise<JsonApiResponse<T>> => {
      const url = buildRequestUrl(route, params, includes);

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
      const url: string = route + '/' + (item.id ?? '') + (includes.length > 0 ? '?include=' + includes.join(',') : '');

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
};

/**
 * @deprecated Use getJsonApiFetch instead: this is not really a React hook so lets not call it that
 */
export default getJsonApiFetch;
