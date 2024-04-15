export const stayIdle = (delayInMs: number) =>
  new Promise((resolve) => setTimeout(resolve, delayInMs));
