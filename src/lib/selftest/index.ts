/**
 * @module
 *
 * The bodies every corpus imports rather than re-authors: the bijection
 * between a register and what the runner would collect, the layering
 * between a corpus and the code it judges, the tie between the images a
 * tree defines and the images its rows name, the toolchain an entry
 * actually resolves, and the sentinel designed to fail.
 *
 * Each opens one suite named by its caller, which is the row's id, so a
 * row's selector finds it; each takes the corpus's own facts as arguments
 * rather than discovering them, because a body that guessed where it was
 * would be asserting something about a tree it inferred. They are shipped
 * as bodies and not as files because the bijection scans the consumer's own
 * tree and has to find itself in it.
 *
 * The two finders behind the bijection are the runner domain's, because the
 * question they answer is also the one a pre-flight asks before a tier is
 * spent, and one question with two implementations is two answers about one
 * corpus the day either of them moves.
 *
 * Every module here imports the test runner at load, which is what a body
 * registering a suite has to do; nothing that has another caller belongs in
 * this domain for that reason alone.
 */

export { UNCLAIMED_TITLE } from "./constants.js";
export { default as describeBijection } from "./describeBijection.js";
export { default as describeCanFail } from "./describeCanFail.js";
export { default as describeImageTie } from "./describeImageTie.js";
export { default as describeLayering } from "./describeLayering.js";
export { default as describeToolchainStamp } from "./describeToolchainStamp.js";
