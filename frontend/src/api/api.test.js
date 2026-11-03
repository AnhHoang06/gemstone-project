import { beforeEach, expect, it } from "vitest";
import api from "./api";
import { saveSession } from "../auth/session";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
const session = token => saveSession({ token, role: "Customer", fullName: token });

it("discards a successful response from the previous account", async () => {
  session("A");
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const request = api.get("/cart", { adapter: config => new Promise(resolve => { finish = () => resolve({ data: { private: "A" }, status: 200, headers: {}, config }); started(); }) });
  const check = expect(request).rejects.toMatchObject({ code: "ERR_CANCELED" });
  await ready; session("B"); finish(); await check;
  expect(localStorage.getItem("token")).toBe("B");
});

it("does not log out the new account on a previous account's late 401", async () => {
  session("A");
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const request = api.get("/cart", { adapter: config => new Promise((resolve, reject) => { finish = () => reject({ config, response: { status: 401 } }); started(); }) });
  const check = expect(request).rejects.toMatchObject({ code: "ERR_CANCELED" });
  await ready; session("B"); finish(); await check;
  expect(localStorage.getItem("token")).toBe("B");
});
