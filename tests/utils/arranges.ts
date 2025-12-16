import { expect, Page, test } from "@playwright/test";

export async function login_admin(page: Page, baseURL:string) {  
  await page.goto(baseURL);
  await page.getByPlaceholder("username or email").fill("zylee");
  await page.getByPlaceholder("password").fill("zylee33");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.locator(".card-title.mb-2").first()).toHaveText(/^Welcome back,/, { timeout: 5000 });
}

export async function login_teacher(page: Page, baseURL:string) {
  await page.goto(baseURL);
  await page.getByPlaceholder("username or email").fill("TeaK");
  await page.getByPlaceholder("password").fill("1234");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.locator(".card-title.mb-2").first()).toHaveText(/^Welcome back,/, { timeout: 5000 });
}

export async function login_student(page: Page, baseURL:string) {
  await page.goto(baseURL);
  await page.getByPlaceholder("username or email").fill("stuA");
  await page.getByPlaceholder("password").fill("1234");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.locator(".card-title.mb-2").first()).toHaveText(/^Welcome back,/, { timeout: 5000 });
}
