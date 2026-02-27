/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DEADROP_SECRETS: KVNamespace;
      };
    };
  }
}
