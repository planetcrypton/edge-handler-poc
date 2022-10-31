export default async (request: Request, context: any) => {
  //const buckets = JSON.parse(Deno.env.get("AB_TEST_LIST") || "null");

  const buckets = [{ url: "https://edge-handler-poc.netlify.app", weight: 0.5 }, { url: "https://deploy-preview-4--edge-handler-poc.netlify.app", weight: 0.5 }]
  //If environment variable not set return standard pages
  if (!buckets || !request) {
    return context.next();
  }

  const requestUrl = new URL(request.url);

  console.log("INC URLS: ", requestUrl.origin, buckets[0].url);

  // if the requests comes from anything but the main sites url we do nothing.
  if (requestUrl.origin !== buckets[0].url || requestUrl.origin !== "https://master--edge-handler-poc.netlify.app") {
    return context.next();
  }

  if (requestUrl.origin.includes("deploy-preview")) {
    return context.next()
  }

  //Ensure weighting adds up to 1
  const totalWeighting = buckets.reduce(
    (tot: any, bucket: any) => tot + bucket.weight,
    0
  );
  const weightingMultiplier = totalWeighting === 1 ? 1 : 1 / totalWeighting;

  //Set the cookie name of the bucket
  const cookieName = "netlify-split-test";

  // Get the bucket from the cookie
  let bucket = context.cookies.get(cookieName);
  let hasBucket = false;

  context.log({ bucket, hasBucket });

  //Check cookie is active cookie
  if (bucket) {
    const isActiveCookie = buckets.find((b: any) => b.url === bucket);

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

  context.log("after: ", { bucket })

  //Generate full proxy url
  const url = `${bucket}${requestUrl.pathname}`;
  context.log("Proxy-URL:", { url });
  //Set cookie if new bucket has been set
  if (!hasBucket) {
    context.cookies.delete(cookieName);
    context.cookies.set({ name: cookieName, value: bucket });
  } 

  const proxyResponse = await fetch(url);
  return new Response(proxyResponse.body, proxyResponse);
};
