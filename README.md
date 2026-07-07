# HotelMarket POS

სასტუმროს მარტივი სალარო GitHub Pages ვიზუალით და Google Sheets ბაზით.

## როგორ არის აწყობილი

- GitHub Pages აჩვენებს სალაროს გვერდს: `index.html`, `style.css`, `app.js`
- Google Apps Script მუშაობს როგორც API და უკავშირდება Google Sheet-ს
- Google Sheet არის მარაგების, გაყიდვების, ოთახზე დარიცხვის და დღის დახურვის ბაზა

## Google Sheet

Sheet ID:

`1-H1lwHr_J8_ITwiI0JDOj9tb-uFSdItetkXj1d5P67U`

## Apps Script-ის ჩასმა

1. გახსენი Google Sheet
2. შედი `Extensions -> Apps Script`
3. ჩასვი ფაილი `apps-script/Code.gs`
4. Project Settings-ში ჩართე `Show appsscript.json manifest file in editor`
5. ჩასვი `apps-script/appsscript.json`
6. გაუშვი ფუნქცია `setupDatabase`
7. მიეცი ავტორიზაცია
8. გააკეთე Deploy: `Deploy -> New deployment -> Web app`

რეკომენდირებული Web App პარამეტრები:

- Execute as: `Me`
- Who has access: `Anyone with the link`

## GitHub Pages-ის ჩართვა

1. შედი repository-ში: `Settings`
2. მარცხნივ აირჩიე `Pages`
3. Source-ში აირჩიე `Deploy from a branch`
4. Branch: `main`
5. Folder: `/root`
6. Save

ამის შემდეგ პროგრამის ლინკი იქნება დაახლოებით:

`https://mamuluxgeo-cmd.github.io/HotelMarket/`

## მიმდინარე API ლინკი

`app.js`-ში ჩასმულია ეს Apps Script Web App ლინკი:

`https://script.google.com/macros/s/AKfycbwqc-d9leOrTtWSxpHKSqgw_F3OWh4BIP4zxgButlVkmwpKG6FaQOL0VAqQZNzhQgLEbQ/exec`

თუ Apps Script-ში ახალ Deploy-ს გააკეთებ და ახალი URL მოგცემს, `app.js`-ში უნდა შეიცვალოს `HM_API_URL`.

## Excel / CSV ატვირთვის სვეტები

| დასახელება | კოდი | რაოდენობა | თვითღირებულება | გასაყიდი ფასი |
|---|---|---:|---:|---:|

თუ იგივე კოდი უკვე არსებობს, რაოდენობა დაემატება და საშუალო თვითღირებულება ავტომატურად გადაითვლება.

## სატესტო მონაცემების გასუფთავება

სატესტო მონაცემების გასუფთავება აღარ ჩანს ვებ-სალაროს პანელში.

ეს ფუნქცია გადატანილია Google Sheet-ის ზედა მენიუში:

`HotelMarket -> სატესტოს გასუფთავება`

მენიუში არის 3 რეჟიმი:

1. მხოლოდ გაყიდვები და დღის დახურვები
2. გაყიდვები + ნაშთების განულება
3. ყველაფერი, პროდუქციიანად

ყოველ რეჟიმზე სისტემა მოგთხოვს დადასტურებას. უნდა ჩაწერო:

`RESET`

## ფუნქციები

- სალარო კოდით / ლაზერით
- ხელით კოდის შეყვანა
- კალათა
- რაოდენობა და გასაყიდი ფასი
- გადახდის ტიპები: ტერმინალი, ოთახზე დაწერა, ნაღდი
- ოთახის ნომერზე დარიცხვა
- მარაგის ავტომატური შემცირება
- პროდუქციის ხელით დამატება
- Excel/CSV ატვირთვა
- საშუალო თვითღირებულების დათვლა
- ნაშთების CSV ჩამოტვირთვა
- ნაშთის კორექტირება
- დღის ანგარიში
- დღის დახურვა
