import path from 'path';
import { OpenAPIFrontend } from './frontend';

import OpenAPIBackend from 'openapi-backend';
import { OpenAPIV3 } from 'openapi-types';
import MockAdapter from 'axios-mock-adapter';

const testsDir = path.join(__dirname, '..', '__tests__');

const examplePetAPIJSON = path.join(testsDir, 'resources', 'example-pet-api.openapi.json');
const examplePetAPIYAML = path.join(testsDir, 'resources', 'example-pet-api.openapi.yml');

const baseURL = 'http://localhost:8080';

const responses: OpenAPIV3.ResponsesObject = {
  200: { description: 'ok' },
};

const pathId: OpenAPIV3.ParameterObject = {
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'integer',
  },
};

const examplePet = {
  id: 1,
  name: 'Garfield',
};

const definition: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'api',
    version: '1.0.0',
  },
  servers: [{ url: baseURL }],
  paths: {
    '/pets': {
      get: {
        operationId: 'getPets',
        responses: {
          200: {
            $ref: '#/components/responses/PetsListRes',
          },
        },
      },
      post: {
        operationId: 'createPet',
        responses: {
          201: {
            $ref: '#/components/responses/PetRes',
          },
        },
      },
    },
    '/pets/{id}': {
      get: {
        operationId: 'getPetById',
        responses: {
          200: {
            $ref: '#/components/responses/PetRes',
          },
        },
      },
      put: {
        operationId: 'replacePetById',
        responses: {
          200: {
            $ref: '#/components/responses/PetRes',
          },
        },
      },
      patch: {
        operationId: 'updatePetById',
        responses: {
          200: {
            $ref: '#/components/responses/PetRes',
          },
        },
      },
      delete: {
        operationId: 'deletePetById',
        responses: {
          200: {
            $ref: '#/components/responses/PetRes',
          },
        },
      },
      parameters: [pathId],
    },
    '/pets/{id}/owner': {
      get: {
        operationId: 'getOwnerByPetId',
        responses,
      },
      parameters: [pathId],
    },
    '/pets/meta': {
      get: {
        operationId: 'getPetsMeta',
        responses,
      },
    },
  },
  components: {
    schemas: {
      PetWithName: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            minimum: 1,
          },
          name: {
            type: 'string',
            example: 'Garfield',
          },
        },
      },
    },
    responses: {
      PetRes: {
        description: 'ok',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PetWithName',
            },
          },
        },
      },
      PetsListRes: {
        description: 'ok',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/PetWithName',
              },
            },
          },
        },
      },
    },
  },
};

describe('OpenAPIFrontend', () => {
  describe('init', () => {
    test('can be initalised with a valid OpenAPI document as JS Object', async () => {
      // @TODO: read a complex document with as many features as possible here
      const api = new OpenAPIFrontend({ definition, strict: true });
      await api.init();
      expect(api.initalized).toEqual(true);
    });

    test('can be initalised using a valid YAML file', async () => {
      const api = new OpenAPIFrontend({ definition: examplePetAPIYAML, strict: true });
      await api.init();
      expect(api.initalized).toEqual(true);
    });

    test('can be initalised using a valid JSON file', async () => {
      const api = new OpenAPIFrontend({ definition: examplePetAPIJSON, strict: true });
      await api.init();
      expect(api.initalized).toEqual(true);
    });

    test('throws an error when initalised with an invalid document in strict mode', async () => {
      const invalid: any = { invalid: 'not openapi' };
      const api = new OpenAPIFrontend({ definition: invalid, strict: true });
      await expect(api.init()).rejects.toThrowError();
    });

    test('emits a warning when initalised with an invalid OpenAPI document not in strict mode', async () => {
      const invalid: any = { invalid: 'not openapi' };
      const warn = console.warn;
      console.warn = jest.fn();
      const api = new OpenAPIFrontend({ definition: invalid, strict: false });
      await api.init();
      expect(console.warn).toBeCalledTimes(1);
      console.warn = warn; // reset console.warn
    });
  });

  describe('client', () => {
    test('has created operation methods for each operationId', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();
      expect(client).toHaveProperty('getPets');
      expect(client).toHaveProperty('createPet');
      expect(client).toHaveProperty('getPetById');
      expect(client).toHaveProperty('replacePetById');
      expect(client).toHaveProperty('updatePetById');
      expect(client).toHaveProperty('deletePetById');
      expect(client).toHaveProperty('getOwnerByPetId');
      expect(client).toHaveProperty('getPetsMeta');
    });

    test('has set default baseURL to the first server in config', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();
      expect(client.defaults.baseURL).toBe(baseURL);
    });

    test("query('getPets') calls GET /pets", async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = [{ id: 1, name: 'Garfield' }];
      const mockHandler = jest.fn((config) => [200, mockResponse]);
      mock.onGet('/pets').reply((config) => mockHandler(config));

      const res = await client.query('getPets');
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });

    test('getPets() calls GET /pets', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = [{ id: 1, name: 'Garfield' }];
      const mockHandler = jest.fn((config) => [200, mockResponse]);
      mock.onGet('/pets').reply((config) => mockHandler(config));

      const res = await client.getPets();
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });

    test("get('/pets') calls GET /pets", async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = [{ id: 1, name: 'Garfield' }];
      const mockHandler = jest.fn((config) => [200, mockResponse]);
      mock.onGet('/pets').reply((config) => mockHandler(config));

      const res = await client.get('/pets');
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });

    test("({ method: 'get', url: '/pets' }) calls GET /pets", async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = [{ id: 1, name: 'Garfield' }];
      const mockHandler = jest.fn((config) => [200, mockResponse]);
      mock.onGet('/pets').reply((config) => mockHandler(config));

      const res = await client({ method: 'get', url: '/pets' });
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });

    test("query('getPetById', 1) calls GET /pets/1", async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = { id: 1, name: 'Garfield' };
      const mockHandler = jest.fn(() => [200, mockResponse]);
      mock.onGet('/pets/1').reply((config) => mockHandler(config));

      const res = await client.query('getPetById', 1);
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });

    test('getPetById(1) calls GET /pets/1', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = { id: 1, name: 'Garfield' };
      const mockHandler = jest.fn(() => [200, mockResponse]);
      mock.onGet('/pets/1').reply((config) => mockHandler(config));

      const res = await client.getPetById(1);
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });

    test("query('createPet', pet) calls POST /pets with JSON payload", async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const pet = { name: 'Garfield' };
      const mockResponse = { id: 1, ...pet };
      const mockHandler = jest.fn(() => [201, mockResponse]);
      mock.onPost('/pets').reply((config) => mockHandler(config));

      const res = await client.query('createPet', pet);
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
      const mockContext = mockHandler.mock.calls[mockHandler.mock.calls.length - 1][0];
      expect(mockContext.data).toEqual(JSON.stringify(pet));
    });

    test('createPet(pet) calls POST /pets with JSON payload', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const pet = { name: 'Garfield' };
      const mockResponse = { id: 1, ...pet };
      const mockHandler = jest.fn(() => [201, mockResponse]);
      mock.onPost('/pets').reply((config) => mockHandler(config));

      const res = await client.createPet(pet);
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
      const mockContext = mockHandler.mock.calls[mockHandler.mock.calls.length - 1][0];
      expect(mockContext.data).toEqual(JSON.stringify(pet));
    });

    test("query('replacePetById', 1, pet) calls PUT /pets/1 with JSON payload", async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const pet = { id: 1, name: 'Garfield' };
      const mockResponse = pet;
      const mockHandler = jest.fn(() => [200, mockResponse]);
      mock.onPut('/pets/1').reply((config) => mockHandler(config));

      const res = await client.replacePetById(1, pet);
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
      const mockContext = mockHandler.mock.calls[mockHandler.mock.calls.length - 1][0];
      expect(mockContext.data).toEqual(JSON.stringify(pet));
    });

    test('replacePetById(1, pet) calls PUT /pets/1 with JSON payload', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const pet = { id: 1, name: 'Garfield' };
      const mockResponse = pet;
      const mockHandler = jest.fn(() => [200, mockResponse]);
      mock.onPut('/pets/1').reply((config) => mockHandler(config));

      const res = await client.replacePetById(1, pet);
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
      const mockContext = mockHandler.mock.calls[mockHandler.mock.calls.length - 1][0];
      expect(mockContext.data).toEqual(JSON.stringify(pet));
    });

    test('deletePetById(1) calls DELETE /pets/1', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = { id: 1, name: 'Garfield' };
      const mockHandler = jest.fn(() => [200, mockResponse]);
      mock.onDelete('/pets/1').reply((config) => mockHandler(config));

      const res = await client.deletePetById(1);
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });
    test('getOwnerByPetId(1) calls GET /pets/1/owner', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = { name: 'Jon' };
      const mockHandler = jest.fn(() => [200, mockResponse]);
      mock.onGet('/pets/1/owner').reply((config) => mockHandler(config));

      const res = await client.getOwnerByPetId(1);
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });

    test('getPetsMeta() calls GET /pets/meta', async () => {
      const api = new OpenAPIFrontend({ definition, strict: true });
      const client = await api.init();

      const mock = new MockAdapter(api.client);
      const mockResponse = { totalPets: 10 };
      const mockHandler = jest.fn(() => [200, mockResponse]);
      mock.onGet('/pets/meta').reply((config) => mockHandler(config));

      const res = await client.getPetsMeta();
      expect(res.data).toEqual(mockResponse);
      expect(mockHandler).toBeCalled();
    });
  });

  describe('mock api using openapi-backend', async () => {
    const mockApi = new OpenAPIBackend({ definition });
    mockApi.register({
      notFound: async () => [404, { err: 'not found' }],
      validationFail: async (c) => [400, { err: c.validation.errors }],
      notImplemented: async (c) => {
        const { status, mock } = mockApi.mockResponseForOperation(c.operation.operationId);
        return [status, mock];
      },
    });

    const api = new OpenAPIFrontend({ definition });
    beforeAll(async () => {
      await api.init();
      api.mock((config) =>
        mockApi.handleRequest({
          method: config.method,
          path: config.url,
          body: config.data,
          headers: config.headers,
        }),
      );
    });

    test('mocks getPets() using openapi-backend', async () => {
      const res = await api.client.getPets();
      expect(res.status).toBe(200);
      expect(res.data).toEqual([examplePet]);
    });

    test('mocks createPet(pet) using openapi-backend', async () => {
      const res = await api.client.createPet(examplePet);
      expect(res.status).toBe(201);
      expect(res.data).toEqual(examplePet);
    });

    test('mocks getPetById(1) using openapi-backend', async () => {
      const res = await api.client.getPetById(1);
      expect(res.status).toBe(200);
      expect(res.data).toEqual(examplePet);
    });

    test("mocks query('getPetById', 1) using openapi-backend", async () => {
      const res = await api.client.query('getPetById', 1);
      expect(res.status).toBe(200);
      expect(res.data).toEqual(examplePet);
    });

    test("mocks get('/pets/1') using openapi-backend", async () => {
      const res = await api.client.get('/pets/1');
      expect(res.status).toBe(200);
      expect(res.data).toEqual(examplePet);
    });

    test("mocks ({ method: 'get', url: '/pets/1' }) using openapi-backend", async () => {
      const res = await api.client({ method: 'get', url: '/pets/1' });
      expect(res.status).toBe(200);
      expect(res.data).toEqual(examplePet);
    });

    test("mocks getPetById('1a') with 400 validation error using openapi-backend", async () => {
      expect(api.client.getPetById('1a')).rejects.toThrowError('400');
    });

    test("mocks get('/unknown') with 404 not found error using openapi-backend", async () => {
      expect(api.client.get('/unknown')).rejects.toThrowError('404');
    });
  });
});
