import { DEFAULT_IMAGE, LOCAL_PREFIX } from "../lib/image/index.js";

/** The name of the image directory this repository defines. */
export const BASE_IMAGE_NAME = DEFAULT_IMAGE;

/**
 * What the tag the integration suite builds the base image under opens
 * with; the setup completes it with its own process id, so two suites on
 * one engine never build and remove one name. It is derived from the name a
 * build gives a local image rather than spelled a second time, so the suite
 * and the command cannot end up naming two conventions.
 */
export const BASE_TAG_PREFIX = `${LOCAL_PREFIX}-${BASE_IMAGE_NAME}:integration`;

/**
 * A small image the suite pulls by digest and starts long-lived containers
 * from: a manifest list of an old tag no developer keeps, so pulling it
 * proves the pull rather than a cache. Handed to the engine by this
 * reference, which it pulls again if a file removed it, never by a store ID.
 */
export const SMALL_IMAGE =
  "docker.io/library/busybox@sha256:73aaf090f3d85aa34ee199857f03fa3a95c8ede2ffd4cc2cdb5b94e566b11662";
