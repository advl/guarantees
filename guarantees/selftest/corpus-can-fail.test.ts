import { describeCanFail } from "@aztlan/guarantees/selftest";

// This entry fails, and that is its whole purpose: its row carries
// `expect = "fail"`, and no tier is called green until it has been seen to
// go red inside the image. Repairing it is the failure.
describeCanFail("corpus-can-fail");
