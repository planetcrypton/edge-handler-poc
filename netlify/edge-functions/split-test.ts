import { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  //const buckets = JSON.parse(Deno.env.get("AB_TEST_LIST") || "null");

  const buckets = [{ url: "https://edge-handler-poc.netlify.app", weight: 0.5 }, { url: "https://deploy-preview-4--edge-handler-poc.netlify.app", weight: 0.5 }]
  //If environment variable not set return standard pages
  if (!buckets || !request) {
    return context.next();
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin.includes("deploy-preview") || requestUrl.origin.includes("master--")) {
    return context.next()
  }

  //Ensure weighting adds up to 1
  const totalWeighting = buckets.reduce(
    (tot, bucket) => tot + bucket.weight,
    0
  );
  const weightingMultiplier = totalWeighting === 1 ? 1 : 1 / totalWeighting;

  //Set the cookie name of the bucket
  const cookieName = "netlify-split-test7";

  // Get the bucket from the cookie
  let bucket = context.cookies.get(cookieName);
  let hasBucket = !!bucket;

  //Check cookie is active cookie
  if (bucket) {
    const isActiveCookie = buckets.find((b) => b.url === bucket);

    if (!isActiveCookie) {
      hasBucket = false;
    }
  }

  //Assign a bucket if the cookie has not been set
  if (!hasBucket) {
    const randomNumber = Math.random();
    let totalWeighting = 0;
    buckets.forEach(b => {
      if (
        totalWeighting <= randomNumber &&
        randomNumber <= totalWeighting + b.weight * weightingMultiplier
      ) {
        bucket = b.url;
        hasBucket = false;
      }
      totalWeighting += b.weight * weightingMultiplier;
    });
  }

  //Set cookie if new bucket has been set
  if (!hasBucket) {
    context.cookies.delete(cookieName);
    context.cookies.set({ name: cookieName, value: bucket });
  }

  // if the assigned bucket is master, dont do proxy request.
  if (bucket == buckets[0].url) {
    return context.next();
  }

  //Generate full proxy url getting base url from bucket and path from incoming request.
  // Will generate an url like https://test-split-test--bilka.netlify.app/[pathname]
  const url = `${bucket}${requestUrl.pathname}`;

  const proxyResponse = await fetch(url);
  return new Response(proxyResponse.body, proxyResponse);
};
