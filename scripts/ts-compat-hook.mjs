export async function resolve(specifier, context, nextResolve) {
  if (specifier === "typescript") {
    return nextResolve("typescript-compat", context);
  }
  return nextResolve(specifier, context);
}
