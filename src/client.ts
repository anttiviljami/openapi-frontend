import axios, { AxiosInstance, AxiosRequestConfig, Method } from 'axios';
import bath from 'bath-es5';
import { parse as parseJSONSchema, dereference } from '@apidevtools/json-schema-ref-parser';
import RefParser = require ('@apidevtools/json-schema-ref-parser');
import dereferenceSync from '@apidevtools/json-schema-ref-parser/lib/dereference';
import RefParserOptions from '@apidevtools/json-schema-ref-parser/lib/options';
import QueryString from 'query-string';
import get from 'lodash/get';
import find from 'lodash/find';
import pick from 'lodash/pick';
import merge from 'lodash/merge';
import flatMap from 'lodash/flatMap';
import isNil from 'lodash/isNil';
import isArray from 'lodash/isArray';
import cloneDeep from 'lodash/cloneDeep';
import {
  OpenAPIV3,
  Document,
  Operation,
  UnknownOperationMethod,
  OperationMethodArguments,
  UnknownOperationMethods,
  RequestConfig,
  ParamType,
  HttpMethod,
  UnknownPathsDictionary,
  Server,
} from './types/client';

/**
 * OpenAPIClient is an AxiosInstance extended with operation methods
 */
export type OpenAPIClient<
  OperationMethods = UnknownOperationMethods,
  PathsDictionary = UnknownPathsDictionary
> = AxiosInstance &
  OperationMethods & {
    api: OpenAPIClientAxios;
    paths: PathsDictionary;
  };

/**
 * Main class and the default export of the 'openapi-client-axios' module
 *
 * @export
 * @class OpenAPIClientAxios
 */
export class OpenAPIClientAxios {
  public document: Document;
  public inputDocument: Document | string;
  public definition: Document;

  public quick: boolean;

  public initialized: boolean;
  public instance: any;

  public axiosConfigDefaults: AxiosRequestConfig;
  public swaggerParserOpts: RefParser.Options;

  private defaultServer: number | string | Server;
  private baseURLVariables: { [key: string]: string | number };

  private transformOperationName: (operation: string) => string;
  private transformOperationMethod: (operationMethod: UnknownOperationMethod, operationToTransform: Operation)
    => UnknownOperationMethod;

  /**
   * Creates an instance of OpenAPIClientAxios.
   *
   * @param opts - constructor options
   * @param {Document | string} opts.definition - the OpenAPI definition, file path or Document object
   * @param {boolean} opts.quick - quick mode, skips validation and doesn't guarantee document is unchanged
   * @param {boolean} opts.axiosConfigDefaults - default axios config for the instance
   * @memberof OpenAPIClientAxios
   */
  constructor(opts: {
    definition: Document | string;
    quick?: boolean;
    axiosConfigDefaults?: AxiosRequestConfig;
    swaggerParserOpts?: RefParser.Options;
    withServer?: number | string | Server;
    baseURLVariables?: { [key: string]: string | number };
    transformOperationName?: (operation: string) => string;
    transformOperationMethod?: (operationMethod: UnknownOperationMethod, operationToTransform: Operation)
      => UnknownOperationMethod;
  }) {
    const optsWithDefaults = {
      quick: false,
      withServer: 0,
      baseURLVariables: {},
      swaggerParserOpts: {} as RefParser.Options,
      transformOperationName: (operationId: string) => operationId,
      transformOperationMethod:
        (operationMethod: UnknownOperationMethod) => operationMethod,
      ...opts,
      axiosConfigDefaults: {
        paramsSerializer: (params) => QueryString.stringify(params, { arrayFormat: 'none' }),
        ...(opts.axiosConfigDefaults || {}),
      } as AxiosRequestConfig,
    };
    this.inputDocument = optsWithDefaults.definition;
    this.quick = optsWithDefaults.quick;
    this.axiosConfigDefaults = optsWithDefaults.axiosConfigDefaults;
    this.swaggerParserOpts = optsWithDefaults.swaggerParserOpts;
    this.defaultServer = optsWithDefaults.withServer;
    this.baseURLVariables = optsWithDefaults.baseURLVariables;
    this.transformOperationName = optsWithDefaults.transformOperationName;
    this.transformOperationMethod = optsWithDefaults.transformOperationMethod;
  }

  /**
   * Returns the instance of OpenAPIClient
   *
   * @readonly
   * @type {OpenAPIClient}
   * @memberof OpenAPIClientAxios
   */
  get client() {
    return this.instance as OpenAPIClient;
  }

  /**
   * Returns the instance of OpenAPIClient
   *
   * @returns
   * @memberof OpenAPIClientAxios
   */
  public getClient = async <Client = OpenAPIClient>(): Promise<Client> => {
    if (!this.initialized) {
      return this.init<Client>();
    }
    return this.instance as Client;
  };

  public withServer(server: number | string | Server, variables: { [key: string]: string | number } = {}) {
    this.defaultServer = server;
    this.baseURLVariables = variables;
  }

  /**
   * Initializes OpenAPIClientAxios and creates a member axios client instance
   *
   * The init() method should be called right after creating a new instance of OpenAPIClientAxios
   *
   * @returns AxiosInstance
   * @memberof OpenAPIClientAxios
   */
  public init = async <Client = OpenAPIClient>(): Promise<Client> => {
    if (this.quick) {
      // to save time, just dereference input document
      this.definition = (await dereference(this.inputDocument, this.swaggerParserOpts)) as Document;
      // in quick mode no guarantees document will be the original document
      this.document = typeof this.inputDocument === 'object' ? this.inputDocument : this.definition;
    } else {
      // load and parse the document
      await this.loadDocument();

      // dereference the document into definition
      this.definition = (await dereference(cloneDeep(this.document), this.swaggerParserOpts)) as Document;
    }

    // create axios instance
    this.instance = this.createAxiosInstance();

    // we are now initialized
    this.initialized = true;
    return this.instance as Client;
  };

  /**
   * Loads the input document asynchronously and sets this.document
   *
   * @memberof OpenAPIClientAxios
   */
  public async loadDocument() {
    this.document = (await parseJSONSchema(this.inputDocument, this.swaggerParserOpts)) as Document;
    return this.document;
  }

  /**
   * Synchronous version of .init()
   *
   * Note: Only works when the input definition is a valid OpenAPI v3 object and doesn't contain remote $refs.
   *
   * @memberof OpenAPIClientAxios
   */
  public initSync = <Client = OpenAPIClient>(): Client => {
    if (typeof this.inputDocument !== 'object') {
      throw new Error(`.initSync() can't be called with a non-object definition. Please use .init()`);
    }

    // set document
    this.document = this.inputDocument;

    // dereference the document into definition
    this.definition = cloneDeep(this.document);
    const parser = new RefParser();
    parser.parse(this.definition);
    parser.schema = this.definition;
    dereferenceSync(parser, new RefParserOptions(this.swaggerParserOpts)); // mutates this.definition (synchronous)

    // create axios instance
    this.instance = this.createAxiosInstance();

    // we are now initialized
    this.initialized = true;
    return this.instance as Client;
  };

  /**
   * Creates a new axios instance, extends it and returns it
   *
   * @memberof OpenAPIClientAxios
   */
  public createAxiosInstance = <Client = OpenAPIClient>(): Client => {
    // create axios instance
    const instance = axios.create(this.axiosConfigDefaults) as OpenAPIClient;

    // set baseURL to the one found in the definition servers (if not set in axios defaults)
    const baseURL = this.getBaseURL();
    if (baseURL && !this.axiosConfigDefaults.baseURL) {
      instance.defaults.baseURL = baseURL;
    }

    // create methods for operationIds
    const operations = this.getOperations();
    for (const operation of operations) {
      const { operationId } = operation;
      if (operationId) {
        instance[this.transformOperationName(operationId)] = this.createOperationMethod(operation);
      }
    }

    // create paths dictionary
    // Example: api.paths['/pets/{id}'].get({ id: 1 });
    instance.paths = {};
    for (const path in this.definition.paths) {
      if (this.definition.paths[path]) {
        if (!instance.paths[path]) {
          instance.paths[path] = {};
        }
        const methods = this.definition.paths[path];
        for (const m in methods) {
          if (methods[m as HttpMethod] && Object.values(HttpMethod).includes(m as HttpMethod)) {
            const method = m as HttpMethod;
            const operation = find(this.getOperations(), { path, method });
            instance.paths[path][method] = this.createOperationMethod(operation);
          }
        }
      }
    }

    // add reference to parent class instance
    instance.api = this;
    return (instance as any) as Client;
  };

  /**
   * Gets the API baseurl defined in the first OpenAPI specification servers property
   *
   * @returns string
   * @memberof OpenAPIClientAxios
   */
  public getBaseURL = (operation?: Operation): string | undefined => {
    if (!this.definition) {
      return undefined;
    }
    if (operation) {
      if (typeof operation === 'string') {
        operation = this.getOperation(operation);
      }
      if (operation.servers && operation.servers[0]) {
        return operation.servers[0].url;
      }
    }

    // get the target server from this.defaultServer
    let targetServer;
    if (typeof this.defaultServer === 'number') {
      if (this.definition.servers && this.definition.servers[this.defaultServer]) {
        targetServer = this.definition.servers[this.defaultServer];
      }
    } else if (typeof this.defaultServer === 'string') {
      for (const server of this.definition.servers) {
        if (server.description === this.defaultServer) {
          targetServer = server;
          break;
        }
      }
    } else if (this.defaultServer.url) {
      targetServer = this.defaultServer;
    }

    // if no targetServer is found, return undefined
    if (!targetServer) {
      return undefined;
    }

    const baseURL = targetServer.url;
    const baseURLVariableSet = targetServer.variables;

    // get baseURL var names
    const baseURLBuilder = bath(baseURL);

    // if there are no variables to resolve: return baseURL as is
    if (!baseURLBuilder.names.length) {
      return baseURL;
    }

    // object to place variables resolved from this.baseURLVariables
    const baseURLVariablesResolved: { [key: string]: string } = {};

    // step through names and assign value from this.baseURLVariables or the default value
    // note: any variables defined in baseURLVariables but not actually variables in baseURL are ignored
    for (const name of baseURLBuilder.names) {
      const varValue = this.baseURLVariables[name];

      if (varValue !== undefined) {
        // if varValue exists assign to baseURLVariablesResolved object
        if (typeof varValue === 'number') {
          // if number, get value from enum array

          const enumVal = baseURLVariableSet[name].enum[varValue];

          if (enumVal) {
            baseURLVariablesResolved[name] = enumVal;
          } else {
            // if supplied value out of range: throw error

            throw new Error(
              `index ${varValue} out of range for enum of baseURL variable: ${name}; \
              enum max index is ${baseURLVariableSet[name].enum.length - 1}`,
            );
          }
        } else if (typeof varValue === 'string') {
          // if string, validate against enum array

          if (baseURLVariableSet[name].enum.includes(varValue)) {
            baseURLVariablesResolved[name] = varValue;
          } else {
            // if supplied value doesn't exist on enum: throw error

            throw new Error(
              `${varValue} is not a valid entry for baseURL variable ${name}; \
                variable must be of the following: ${baseURLVariableSet[name].enum.join(', ')}`,
            );
          }
        }
      } else {
        // if varValue doesn't exist: get default

        baseURLVariablesResolved[name] = baseURLVariableSet[name].default;
      }
    }

    // return resolved baseURL
    return baseURLBuilder.path(baseURLVariablesResolved);
  };

  /**
   * Creates an axios config object for operation + arguments
   * @memberof OpenAPIClientAxios
   */
  public getAxiosConfigForOperation = (operation: Operation | string, args: OperationMethodArguments) => {
    if (typeof operation === 'string') {
      operation = this.getOperation(operation);
    }
    const request = this.getRequestConfigForOperation(operation, args);

    // construct axios request config
    const axiosConfig: AxiosRequestConfig = {
      method: request.method as Method,
      url: request.path,
      data: request.payload,
      params: request.query,
      headers: request.headers,
    };

    // allow overriding baseURL with operation / path specific servers
    const { servers } = operation;
    if (servers && servers[0]) {
      axiosConfig.baseURL = servers[0].url;
    }

    // allow overriding any parameters in AxiosRequestConfig
    const [, , config] = args;
    return config ? merge(axiosConfig, config) : axiosConfig;
  };

  /**
   * Creates a generic request config object for operation + arguments.
   *
   * This function contains the logic that handles operation method parameters.
   *
   * @memberof OpenAPIClientAxios
   */
  public getRequestConfigForOperation = (operation: Operation | string, args: OperationMethodArguments) => {
    if (typeof operation === 'string') {
      operation = this.getOperation(operation);
    }

    const pathParams = {} as RequestConfig['pathParams'];
    const query = {} as RequestConfig['query'];
    const headers = {} as RequestConfig['headers'];
    const cookies = {} as RequestConfig['cookies'];

    const setRequestParam = (name: string, value: any, type: ParamType | string) => {
      switch (type) {
        case ParamType.Path:
          pathParams[name] = value;
          break;
        case ParamType.Query:
          query[name] = value;
          break;
        case ParamType.Header:
          headers[name] = value;
          break;
        case ParamType.Cookie:
          cookies[name] = value;
          break;
      }
    };

    const getParamType = (paramName: string): ParamType => {
      const param = find((operation as Operation).parameters, { name: paramName }) as OpenAPIV3.ParameterObject;
      if (param) {
        return param.in as ParamType;
      }
      // default all params to query if operation doesn't specify param
      return ParamType.Query;
    };

    const getFirstOperationParam = () => {
      const firstRequiredParam = find((operation as Operation).parameters, {
        required: true,
      }) as OpenAPIV3.ParameterObject;
      if (firstRequiredParam) {
        return firstRequiredParam;
      }
      const firstParam = get((operation as Operation).parameters, '0') as OpenAPIV3.ParameterObject;
      if (firstParam) {
        return firstParam;
      }
    };

    const [paramsArg, payload] = args;
    if (isArray(paramsArg)) {
      // ParamsArray
      for (const param of paramsArg) {
        setRequestParam(param.name, param.value, param.in || getParamType(param.name));
      }
    } else if (typeof paramsArg === 'object') {
      // ParamsObject
      for (const name in paramsArg) {
        if (paramsArg[name] !== undefined) {
          setRequestParam(name, paramsArg[name], getParamType(name));
        }
      }
    } else if (!isNil(paramsArg)) {
      const firstParam = getFirstOperationParam();
      if (!firstParam) {
        throw new Error(`No parameters found for operation ${operation.operationId}`);
      }
      setRequestParam(firstParam.name, paramsArg, firstParam.in as ParamType);
    }

    // path parameters
    const pathBuilder = bath(operation.path);
    // make sure all path parameters are set
    for (const name of pathBuilder.names) {
      const value = pathParams[name];
      pathParams[name] = `${value}`;
    }
    const path = pathBuilder.path(pathParams);

    // query parameters
    const queryString = QueryString.stringify(query, { arrayFormat: 'none' });

    // full url with query string
    const url = `${this.getBaseURL(operation)}${path}${queryString ? `?${queryString}` : ''}`;

    // construct request config
    const config: RequestConfig = {
      method: operation.method,
      url,
      path,
      pathParams,
      query,
      queryString,
      headers,
      cookies,
      payload,
    };
    return config;
  };

  /**
   * Flattens operations into a simple array of Operation objects easy to work with
   *
   * @returns {Operation[]}
   * @memberof OpenAPIBackend
   */
  public getOperations = (): Operation[] => {
    const paths = this.definition?.paths || {};
    return flatMap(Object.entries(paths), ([path, pathObject]) => {
      const methods = pick(pathObject, Object.values(HttpMethod));
      return Object.entries(methods).map(([method, operation]) => {
        const op: Operation = {
          ...(typeof operation === 'object' ? operation : {}),
          path,
          method: method as HttpMethod,
        };
        if (pathObject.parameters) {
          op.parameters = [...(op.parameters || []), ...pathObject.parameters];
        }
        if (pathObject.servers) {
          op.servers = [...(op.servers || []), ...pathObject.servers];
        }
        return op;
      });
    });
  };

  /**
   * Gets a single operation based on operationId
   *
   * @param {string} operationId
   * @returns {Operation}
   * @memberof OpenAPIBackend
   */
  public getOperation = (operationId: string): Operation | undefined => {
    return find(this.getOperations(), { operationId });
  };

  /**
   * Creates an axios method for an operation
   * (...pathParams, data?, config?) => Promise<AxiosResponse>
   *
   * @param {Operation} operation
   * @memberof OpenAPIClientAxios
   */
  private createOperationMethod = (operation: Operation): UnknownOperationMethod => {
    const originalOperationMethod = async (...args: OperationMethodArguments) => {
      const axiosConfig = this.getAxiosConfigForOperation(operation, args);
      // do the axios request
      return this.client.request(axiosConfig);
    };

    return this.transformOperationMethod(originalOperationMethod, operation);
  };
}
