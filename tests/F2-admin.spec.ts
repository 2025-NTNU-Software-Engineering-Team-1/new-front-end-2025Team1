import { test, expect } from "@playwright/test";
import path from "path";
import { login_admin } from "./utils/arranges";

test.beforeEach(async ({ page, baseURL }) => {
  await login_admin(page, baseURL!);
});

//002
test("Admin can set problem", async ({ page }) => {
  // Get in New prob setting pages
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  await page.getByRole("link", { name: "New" }).click();
  
  //Name & Quotas
  await page.locator("input.input.input-bordered").nth(0).fill("Prob1");
  await page.locator("input.input.input-bordered").nth(1).fill("-1");
  
  //visible
  await page.uncheck('input[type="checkbox"].toggle-success');
  
  //Descriptions, In/Output, and Hint
  await page.locator("textarea.textarea-bordered").nth(0).fill("plus");
  await page.locator("textarea.textarea-bordered").nth(1).fill("Two integers");
  await page.locator("textarea.textarea-bordered").nth(2).fill("Sum");
  await page.locator("textarea.textarea-bordered").nth(3).fill("\+");
  await page.locator("textarea.textarea-bordered").nth(4).fill("10 20");
  await page.locator("textarea.textarea-bordered").nth(5).fill("30");
  
  //Upload files (zip)
  const filePath = path.join(process.env.HOME!, "Downloads", "Prob1.zip"); // Linux Home/Downloads
  await page.locator("#file-uploader").setInputFiles(filePath);
  
  //set subtask score
  await page.waitForTimeout(1000);
  await page.locator("input.input.input-bordered").nth(4).fill("100");
  
  //submit
  await page.locator('button:has-text("Submit")').click();
  await page.waitForTimeout(1000);

  //check if success
  const PID = await page.locator("span").nth(0).textContent();
  await expect(page).toHaveURL(`http://localhost:8080/course/meow/problem/${PID}`);
});

//010 TODO
test.skip("Admin set TEST", async ({ page }) => {
  //Get into the problems page
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Problems" }).click();
  
  //Find all visible problems
  const tds = page.locator("tr.hover td");
  await page.waitForTimeout(1000);
  const count = await tds.count();
  
  //Find Prob1
  let PID = "";
  for (let i = 0; i < count / 5; ++i){
    const td = tds.nth(i * 5 + 1);
    const name = await td.textContent();
    if (name == "Prob1")
    {
      const pid_td = tds.nth(i * 5);
      PID = await pid_td.innerText();
      
      const link = await pid_td.locator("a");
      await link.click();
      break;
    }
  }
  await page.waitForTimeout(1000);
  
  //Get into setting
  await page.getByRole("link", { name: "Test" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("link", { name: "Test" }).click();
  await page.waitForTimeout(1000);
  
  //TODO: Upload testcase
});

//014
test("Admin can see submission list", async ({ page }) => {
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Submissions" }).click();

  await expect(page.locator(".card-title").first()).toHaveText("Submissions");

  const table = await page.locator(".card table").first();
  await expect(table.locator("th")).toHaveCount(10);
  await expect(table.locator("th")).toHaveText(
    ["ID", "PID", "User", "Result", "Score", "Run Time", "Memory", "Lang", "Time", "IP ADDRESS"],
    { ignoreCase: true },
  );
});

//016
test("Admin can download submission list", async ({ page }) => {
  await page.getByRole("link", { name: "Course" }).click();
  await page.getByRole("link", { name: "meow" }).click();
  await page.getByRole("link", { name: "Submissions" }).click();
  
  const [ download ] = await Promise.all([page.waitForEvent("download"), page.locator("xpath=//*[@id=\"app\"]/div/div[1]/div[2]/div[2]/div/div/div/div/div[1]/div/div/div").click()]);

  await download.saveAs("submissions.json");
  console.log("Download saved!");
});


