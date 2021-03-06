import * as E from 'fp-ts/lib/Either';
import * as t from 'io-ts';

// Notes:
//  - All types are io-ts types, so we can serialize/deserialize them safely.
//    It not only improves reliability but also opens a lot of fancy use cases.
//  - We don't use branded types (like FaunaID, Days, etc.),
//    because it would confuse people. To be reconsidered later.
//  - We don't use t.strict, because it only removes props.

// Errors

/**
 * Fetch error. It happens when network is down.
 */
export const FaunaFetchError = t.type({
  type: t.literal('FaunaFetchError'),
  message: t.string,
});
export type FaunaFetchError = t.TypeOf<typeof FaunaFetchError>;

/**
 * Decode error. It happens when Fauna client can't decode FaunaDB response.
 */
export const FaunaDecodeError = t.type({
  type: t.literal('FaunaDecodeError'),
  errors: t.array(t.string),
});
export type FaunaDecodeError = t.TypeOf<typeof FaunaDecodeError>;

// TODO: It will be more generic or union.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const faunaHttpError = <C extends string, P extends string>(
  code: C,
  position: P,
) =>
  t.intersection([
    t.type({
      code: t.literal(code),
      description: t.string,
      position: t.tuple([t.literal(position)]),
    }),
    t.partial({
      failures: t.array(
        t.type({
          code: t.literal('duplicate value'),
          description: t.string,
          field: t.array(t.string),
        }),
      ),
    }),
  ]);

export const FaunaHttpErrorInstanceAlreadyExists = faunaHttpError(
  'instance already exists',
  'create_collection',
);
export type FaunaHttpErrorInstanceAlreadyExists = t.TypeOf<
  typeof FaunaHttpErrorInstanceAlreadyExists
>;

export const FaunaHttpErrorInvalidRef = faunaHttpError('invalid ref', 'delete');
export type FaunaHttpErrorInvalidRef = t.TypeOf<
  typeof FaunaHttpErrorInvalidRef
>;

export const FaunaHttpErrorValidationFailed = faunaHttpError(
  'validation failed',
  'create_collection',
);
export type FaunaHttpErrorValidationFailed = t.TypeOf<
  typeof FaunaHttpErrorValidationFailed
>;

//

/**
 * Errors returned by the FaunaDB server.
 */
export const FaunaHttpErrorsRaw = t.type({
  errors: t.array(
    t.union([
      FaunaHttpErrorInstanceAlreadyExists,
      FaunaHttpErrorInvalidRef,
      FaunaHttpErrorValidationFailed,
    ]),
  ),
});
export type FaunaHttpErrorsRaw = t.TypeOf<typeof FaunaHttpErrorsRaw>;

/**
 * `FaunaHttpErrorsRaw` with prop `type` for exhaustiveness checking.
 */
export const FaunaHttpErrors = t.intersection([
  FaunaHttpErrorsRaw,
  t.type({ type: t.literal('FaunaHttpErrors') }),
]);
export type FaunaHttpErrors = t.TypeOf<typeof FaunaHttpErrors>;

/**
 * Unknown errors returned by the FaunaDB server.
 */
export const FaunaUnknownHttpErrors = t.type({
  type: t.literal('FaunaUnknownHttpErrors'),
  errors: t.array(t.unknown),
});
export type FaunaUnknownHttpErrors = t.TypeOf<typeof FaunaUnknownHttpErrors>;

export const FaunaError = t.union([
  FaunaFetchError,
  FaunaDecodeError,
  FaunaHttpErrors,
  FaunaUnknownHttpErrors,
]);
export type FaunaError = t.TypeOf<typeof FaunaError>;

// Models

/**
 * A structure containing the request and response context for a given FaunaDB
 * request. Provided to an observer function optionally defined in the
 * `Client` constructor.
 */
export const RequestResponse = t.type({
  /** The HTTP method used in the request. */
  method: t.keyof({ GET: null, POST: null }),

  /** The path that was queried. Relative to the client's domain. */
  path: t.string,

  /** The HTTP response status code. */
  statusCode: t.number,

  /** The HTTP headers returned in the response. */
  responseHeaders: t.UnknownRecord,

  /** The time the request was issued by the client. */
  startTime: t.number,

  /** The time the response was received by the client. */
  endTime: t.number,

  /** `this.endTime - this.startTime`: Time taken in milliseconds. */
  timeTaken: t.number,

  // TODO:
  // /** URL query parameters. Only set if `method` is "GET". */
  // query: t.union([t.string, t.null]),

  /** The JSON request string, if any. */
  request: t.union([t.string, t.undefined]),

  /** The response data parsed as JSON. */
  response: t.unknown,
});
export type RequestResponse = t.TypeOf<typeof RequestResponse>;

/**
 * Fauna Long type as JavaScript Date.
 */
const DateFromFaunaLong = new t.Type<Date, number, unknown>(
  // https://github.com/gcanti/io-ts-types/blob/master/src/DateFromUnixTime.ts
  'DateFromFaunaLong',
  (u): u is Date => u instanceof Date,
  (u, c) =>
    E.either.chain(t.Int.validate(u, c), (n) => {
      const d = new Date(n / 1000);
      return isNaN(d.getTime()) ? t.failure(u, c) : t.success(d);
    }),
  (a) => a.getTime() * 1000,
);

/**
 * The CreateCollection function is used to create a collection that groups
 * documents. Once the collection has been created, it is possible to create
 * documents within the collection. You cannot create a collection and insert
 * documents into that collection in the same transaction.
 */
export const CreateCollection = t.type({
  create_collection: t.type({
    // That's how we create optional fields with io-ts.
    object: t.intersection([
      // Required.
      t.type({
        /**
         * The name of the collection. Collections cannot be named any of
         * the following reserved words: events, set, self, documents, or _.
         */
        name: t.string,
      }),
      // Optional.
      t.partial({
        /**
         * This is user-defined metadata for the collection. It is provided
         * for the developer to store information at the collection level.
         */
        data: t.UnknownRecord,
        /**
         * The number of days that document history is retained for in this
         * collection. The default is 30 days.
         * Not setting history_days retains this collection’s history forever.
         * Setting history_days to 0 retains only the current version of each
         * document in this collection; no history is retained.
         */
        history_days: t.number,
        /**
         * The number of days documents are retained for this collection.
         * Documents which have not been updated within the configured TTL duration
         * are removed. Not setting ttl_days retains documents forever.
         */
        ttl_days: t.number,
        // TODO: permissions: Permissions
      }),
    ]),
  }),
});
export type CreateCollection = t.TypeOf<typeof CreateCollection>;

// TODO:
//  - Refactor to generic Ref probably.
//  - Create CollectionRefFromCollectionRefRaw (with id etc.)
export const CollectionRef = t.type({
  '@ref': t.type({
    id: t.string,
    collection: t.type({
      '@ref': t.type({ id: t.literal('collections') }),
    }),
  }),
});
export type CollectionRef = t.TypeOf<typeof CollectionRef>;

export const Collection = t.type({
  name: t.string,
  ref: CollectionRef,
  ts: DateFromFaunaLong,
  history_days: t.number,
});
export type Collection = t.TypeOf<typeof Collection>;

export const Delete = t.type({
  delete: t.type({ collection: t.string }), // Will be union.
});
export type Delete = t.TypeOf<typeof Delete>;

export const Expression = t.union([CreateCollection, Delete]);
export type Expression = t.TypeOf<typeof Expression>;
