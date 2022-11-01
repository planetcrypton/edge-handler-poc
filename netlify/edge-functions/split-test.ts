import { Context } from "https://edge.netlify.com";
import { Md5 } from "https://deno.land/std@0.153.0/hash/md5.ts";

export default async (request: Request, context: Context) => {
  const buckets = JSON.parse(Deno.env.get("AB_TEST_LIST") || "null");
  //context.log(bucketsv2);
  // const buckets = [{ url: "https://edge-handler-poc.netlify.app", weight: 0.5 }, { url: "https://deploy-preview-4--edge-handler-poc.netlify.app", weight: 0.5 }]

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
    (tot: any, bucket: any) => tot + bucket.weight,
    0
  );
  const weightingMultiplier = totalWeighting === 1 ? 1 : 1 / totalWeighting;

  // Generate md5 hash from bucket urls
  const branchNames = buckets.map(b => b.url).join();
  const hash = new Md5();
  hash.update(branchNames)

  const cookieName = hash.toString();

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
    buckets.forEach((b: any) => {
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
    // Set cookie to expire after 90 days.
    const maxCookieAge = 7776000;

    context.cookies.delete(cookieName);
    context.cookies.set({ name: cookieName, value: bucket, maxAge: maxCookieAge });
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
