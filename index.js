import faunadb from 'faunadb';
import parse from 'parse-url';
import { customAlphabet } from 'nanoid';
import { corsHeaders, getFaunaError } from './utils'

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

const faunaClient = new faunadb.Client({
  secret: SECRET_DB_KEY
});

const { Create, Collection, Match, Index, Get, Ref, Paginate, Sum, Delete, Add, Select, Let, Var, Update } = faunadb.query;

/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handleRequest(request) {
  const api = parse(request.url);
  if (api.pathname === '/shorten' && request.method === 'OPTIONS') {
    return new Response('OK', {
      headers: corsHeaders,
      status: 200
    });
  }
  if (api.pathname === '/shorten' && request.method === 'POST') {
    try {
      const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);
      const shortId = nanoid();
      const { url } = await request.json();

      await faunaClient.query(
        Create(
          Collection('URL_SHORTID'),
          {
            data: {
              url: url, shortId: shortId, times: 0
            }
          }
        )
      );

      const body = JSON.stringify({ url: url, shortId: shortId });
      return new Response(body, {
        headers: corsHeaders,
        status: 200
      });
    } catch (error) {
      const faunaError = getFaunaError(error);
      return new Response(
        JSON.stringify({ message: faunaError }),
        {
          headers: corsHeaders,
          status: faunaError.status
        }
      );
    }
  }

  if (api.pathname === '/access' && request.method === 'OPTIONS') {
    return new Response('OK', {
      headers: corsHeaders,
      status: 200
    });
  }

  if (api.pathname === '/access' && request.method === 'GET') {
    const params = (new URL(request.url)).searchParams;
    const shortId = params.get('shortId');
    const result = await faunaClient.query(
      Get(Match(Index('registry_by_shortId'), shortId))
    );
    const url = result.data.url;
    if (url) {
      await faunaClient.query(
        Update(Ref(Collection('URL_SHORTID'), result.ref.id), {
          data: {
            times: result.data.times + 1
          }
        })
      );
      return new Response(JSON.stringify({ url: url, times: result.data.times + 1 }), {
        headers: corsHeaders,
        status: 200
      });
    } else {
      return new Response(JSON.stringify({ url: '', times: 0 }), {
        headers: corsHeaders,
        status: 200
      });
    }
  }

  return new Response(JSON.stringify({ message: '404 ... ERROR, not found' }), {
    headers: corsHeaders,
    status: 404
  })
}
