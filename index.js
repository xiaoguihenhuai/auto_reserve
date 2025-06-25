const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");


const runChecker = async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    executablePath: '/usr/bin/chromium', // インストールパスを確認
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const urlList = [
    'https://www.cm1.eprs.jp/yoyaku-chiba/ew/facilities.jsp?bcd=Y4010',
    'https://www.cm1.eprs.jp/yoyaku-chiba/ew/facilities.jsp?bcd=Y4020',
    'https://www.cm1.eprs.jp/yoyaku-chiba/ew/facilities.jsp?bcd=Y4030',
  ];

  const allResult = {};

  for (const url of urlList) {
    await page.goto(url);

    // 検索ボタンの待機とクリック
    const searchButton = await page.waitForSelector(
      "#disp > center > form > table:nth-child(2) > tbody > tr > td > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr > td > table > tbody > tr:nth-child(7) > td > a",
      { timeout: 5000 }
    );

    if (searchButton) {
      await new Promise((r) => setTimeout(r, 2000));
      await searchButton.click();
    }

    // 各施設のループ
    while (true) {
      await new Promise((r) => setTimeout(r, 2000));
      await page.waitForSelector("#disp > center > table:nth-child(5)", {
        timeout: 5000,
      });

      const { facilityName, result } = await page.evaluate(() => {
        const result = {};
        const table = document.querySelector("#disp > center > table:nth-child(5)");
        if (!table) return { facilityName: "", result };
        const rows = table.querySelectorAll("tbody tr");
        let satIndex = -1, sunIndex = -1, satDate = "", sunDate = "";

        const headerCells = rows[5]?.querySelectorAll("td");
        headerCells?.forEach((cell, index) => {
          const text = cell.textContent?.trim();
          if (text?.includes("土")) {
            satIndex = index;
            satDate = text;
            result[satDate] = [];
          }
          if (text?.includes("日")) {
            sunIndex = index;
            sunDate = text;
            result[sunDate] = [];
          }
        });

        rows.forEach((row, rowIndex) => {
          if (rowIndex === 0) return;
          const cells = row.querySelectorAll("td");
          const time = cells[0]?.textContent?.trim();

          if (satIndex !== -1) {
            const alt = cells[satIndex]?.querySelector("img")?.alt;
            if (alt === "空き") result[satDate].push(time);
          }
          if (sunIndex !== -1) {
            const alt = cells[sunIndex]?.querySelector("img")?.alt;
            if (alt === "空き") result[sunDate].push(time);
          }
        });

        let facilityName = document.querySelector('#disp > center > table:nth-child(5) font[size="+1"] b')?.textContent || "";
        facilityName = facilityName.replace(/[\n\t\s]/g, "");
        return { facilityName, result };
      });

      if (facilityName && !facilityName.includes("野球場")) {
        if (!allResult[facilityName]) allResult[facilityName] = [];
        allResult[facilityName].push(result);
      }

      const nextFacilityElement = await page.$(
        "#disp > center > table:nth-child(5) > tbody:nth-child(1) > tr > td > table > tbody > tr > td:nth-child(3) > a"
      );

      if (nextFacilityElement) {
        await new Promise((r) => setTimeout(r, 2000));
        await nextFacilityElement.click();
      } else {
        break;
      }
    }
  }

  console.log(allResult);

  // メール送信処理
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "duyajie05@gmail.com",
      pass: "thwazsqqbeqfclsi", // セキュリティ注意：実運用では環境変数や安全な手段を使ってください
    },
  });

  function formatAvailability(allResult) {
    let text = "空き情報はこちら：\n";
    for (const facility in allResult) {
      text += `\n【${facility}】\n`;
      allResult[facility].forEach((item) => {
        for (const date in item) {
          const times = item[date];
          if (times.length > 0) {
            text += `${date}: ${times.join(", ")}\n`;
          } 
        }
      });
    }
    return text;
  }
  
  const mailText = formatAvailability(allResult);
  console.log("メール内容:", mailText);

  const mailOptions = {
    from: "duyajie05@gmail.com",
    to: "your-to-address@example.com",
    subject: "施設の空き情報",
    text: formatAvailability(allResult),
  };

  // await transporter.sendMail(mailOptions);
  console.log("メール送信完了");

  await browser.close();
}


runChecker(); // 初回実行
