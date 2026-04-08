# japanese_n5_grammar — Static In-Game Quiz Audit

- Total facts: **375**
- Flagged: **41** (10.9%)

Each row shows the rendered question, correct answer, and the 3 distractors a player would see.
Selection is deterministic (seeded PRNG keyed on fact.id).

## Pool: `adjective_form` (6 facts)

| Fact ID | Question | Correct | D1 | D2 | D3 | Flags |
|---|---|---|---|---|---|---|
|ja-gram-n5-n5-adj-i-fill-0|この映画は面白{___}です。<br>(This movie is interesting.)|い|な|も|は||
|ja-gram-n5-n5-adj-i-fill-1|今日は寒くな{___}ですね。<br>(It's not cold today, is it.)|い|の|前に|に||
|ja-gram-n5-n5-adj-i-fill-3|高{___}山ですね。<br>(That's a tall mountain, isn't it.)|い|この|が|に行く||
|ja-gram-n5-n5-adj-i-fill-4|この料理はお{___}しくなかった。<br>(This dish was not delicious.)|い|ので|より〜ほうが|まで|LENGTH_TELL|
|ja-gram-n5-n5-adj-na-fill-1|元気{___}子供ですね。<br>(That's a lively child, isn't it.)|な|すぎる|のが好き|が||
|ja-gram-n5-n5-adj-na-fill-3|静か{___}部屋が好きです。<br>(I like quiet rooms.)|な|がいる|ない|なくてもいい|LENGTH_TELL|

## Pool: `demonstrative` (15 facts)

| Fact ID | Question | Correct | D1 | D2 | D3 | Flags |
|---|---|---|---|---|---|---|
|ja-gram-n5-n5-dem-koko-soko-asoko-fill-0|{___}に座ってください。<br>(Please sit here.)|ここ|ないでください|この|いっしょに||
|ja-gram-n5-n5-dem-koko-soko-asoko-fill-1|{___}に鍵があります。<br>(The key is there.)|そこ|と思う|ている|を||
|ja-gram-n5-n5-dem-koko-soko-asoko-fill-2|{___}に郵便局があります。<br>(There is a post office over there.)|あそこ|ここ|そこ|これ||
|ja-gram-n5-n5-dem-koko-soko-asoko-fill-3|{___}はどこですか。<br>(Where is this place?)|ここ|ている|この|すぎる||
|ja-gram-n5-n5-dem-koko-soko-asoko-fill-4|トイレは{___}です。<br>(The restroom is there.)|そこ|に|と思う|前に||
|ja-gram-n5-n5-dem-kono-sono-ano-fill-0|{___}本はおもしろいです。<br>(This book is interesting.)|この|だけ|がある|が||
|ja-gram-n5-n5-dem-kono-sono-ano-fill-1|{___}映画を見ましたか。<br>(Did you see that movie?)|その|何|たい|まだ||
|ja-gram-n5-n5-dem-kono-sono-ano-fill-2|{___}山は富士山です。<br>(That mountain over there is Mt. Fuji.)|あの|これ|それから|ここ||
|ja-gram-n5-n5-dem-kono-sono-ano-fill-3|{___}人は誰ですか。<br>(Who is this person?)|この|いつも|ここ|てある||
|ja-gram-n5-n5-dem-kono-sono-ano-fill-4|{___}店のケーキはおいしいです。<br>(The cake from that shop over there is delicious.)|あの|な|がある|で||
|ja-gram-n5-n5-dem-kore-sore-are-fill-0|{___}はイチゴケーキです。<br>(This is strawberry cake.)|これ|でしょう|ましょう|ここ||
|ja-gram-n5-n5-dem-kore-sore-are-fill-1|{___}はりんごケーキです。<br>(That is apple cake.)|それ|方|も|の||
|ja-gram-n5-n5-dem-kore-sore-are-fill-2|{___}は何のケーキでしょうか。<br>(I wonder what that cake over there is?)|あれ|がほしい|はどうですか|けど||
|ja-gram-n5-n5-dem-kore-sore-are-fill-3|すみません！{___}はいくらですか？<br>(Excuse me! How much is this?)|これ|じゃない|か|をください||
|ja-gram-n5-n5-dem-kore-sore-are-fill-4|{___}は私の車です。<br>(That over there is my car.)|あれ|ないといけない|が|それから||

## Pool: `existence_pattern` (9 facts)

| Fact ID | Question | Correct | D1 | D2 | D3 | Flags |
|---|---|---|---|---|---|---|
|ja-gram-n5-n5-exist-ga-aru-fill-0|机の上に本{___}。<br>(There is a book on the desk.)|があります|で|か〜か|じゃない||
|ja-gram-n5-n5-exist-ga-aru-fill-1|近くにコンビニ{___}か。<br>(Is there a convenience store nearby?)|があります|のが上手|すぎる|たい||
|ja-gram-n5-n5-exist-ga-aru-fill-2|冷蔵庫にミルク{___}。<br>(There is no milk in the refrigerator.)|がありません|で|か〜か|に|LENGTH_TELL|
|ja-gram-n5-n5-exist-ga-aru-fill-3|明日は授業{___}。<br>(There is no class tomorrow.)|がありません|なくてはいけない|てから|がいる||
|ja-gram-n5-n5-exist-ga-iru-fill-0|公園に子供{___}。<br>(There are children in the park.)|がいます|で|に|いっしょに||
|ja-gram-n5-n5-exist-ga-iru-fill-1|猫{___}。<br>(There is a cat.)|がいます|の|がある|てある||
|ja-gram-n5-n5-particle-no-possessive-fill-0|私は車{___}。<br>(I have a car.)|があります|は|まで|をください||
|ja-gram-n5-n5-particle-no-possessive-fill-1|この学校は図書館{___}か。<br>(Does this school have a library?)|があります|か〜か|がいる|の||
|ja-gram-n5-n5-particle-no-possessive-fill-3|あなたは質問{___}か。<br>(Do you have a question?)|があります|がいる|けど|だ||

## Pool: `particle_case` (114 facts)

| Fact ID | Question | Correct | D1 | D2 | D3 | Flags |
|---|---|---|---|---|---|---|
|ja-gram-n5-n5-adv-ichiban-fill-0|寿司が{___}好きです。<br>(I like sushi the best.)|一番|まだ|で|か〜か||
|ja-gram-n5-n5-adv-ichiban-fill-1|富士山は日本で{___}高い山です。<br>(Mt. Fuji is the tallest mountain in Japan.)|一番|お|に|で||
|ja-gram-n5-n5-adv-ichiban-fill-2|クラスの中でだれが{___}背が高いですか。<br>(Who is the tallest in the class?)|一番|てある|の|を||
|ja-gram-n5-n5-adv-ichiban-fill-3|どの季節が{___}好きですか。<br>(Which season do you like the best?)|一番|は|に|へ||
|ja-gram-n5-n5-adv-issho-ni-fill-0|{___}行きませんか。<br>(Won't you go together?)|一緒に|を|まだ|がある||
|ja-gram-n5-n5-adv-issho-ni-fill-1|友達と{___}勉強しました。<br>(I studied together with a friend.)|一緒に|か〜か|より〜ほうが|と||
|ja-gram-n5-n5-adv-issho-ni-fill-2|家族と{___}食事をします。<br>(I eat meals together with my family.)|一緒に|か|は〜より|たり〜たり||
|ja-gram-n5-n5-adv-issho-ni-fill-3|{___}写真を撮りましょう。<br>(Let's take a photo together.)|一緒に|が|それから|から||
|ja-gram-n5-n5-adv-itsumo-fill-0|{___}七時に起きます。<br>(I always wake up at seven.)|いつも|お|もう|や||
|ja-gram-n5-n5-adv-itsumo-fill-1|彼は{___}遅れてきます。<br>(He always comes late.)|いつも|で|前に|か||
|ja-gram-n5-n5-adv-itsumo-fill-2|{___}ありがとうございます。<br>(Thank you as always.)|いつも|が|に|を||
|ja-gram-n5-n5-adv-itsumo-fill-3|母は{___}料理が上手です。<br>(My mother is always good at cooking.)|いつも|へ|も|でも||
|ja-gram-n5-n5-adv-mada-fill-0|{___}食べていません。<br>(I haven't eaten yet.)|まだ|と|いっしょに|まだ〜ていません||
|ja-gram-n5-n5-adv-mada-fill-1|宿題が{___}あります。<br>(I still have homework.)|まだ|てから|に行く|まだ〜ていません||
|ja-gram-n5-n5-adv-mada-fill-2|{___}日本語が上手じゃないです。<br>(My Japanese is still not good.)|まだ|しかし|ないといけない|か〜か||
|ja-gram-n5-n5-adv-mada-fill-3|彼は{___}寝ています。<br>(He is still sleeping.)|まだ|ないでください|まだ〜ていません|てから||
|ja-gram-n5-n5-adv-mou-fill-0|{___}食べました。<br>(I already ate.)|もう|てから|前に|から||
|ja-gram-n5-n5-adv-mou-fill-1|{___}すぐ着きます。<br>(I will arrive soon.)|もう|まだ〜ていません|たり〜たり|いくら||
|ja-gram-n5-n5-adv-mou-fill-2|{___}お酒は飲みません。<br>(I won't drink alcohol anymore.)|もう|や|よ|前に||
|ja-gram-n5-n5-adv-mou-fill-3|{___}終わりました。<br>(It is already finished.)|もう|の中で〜が一番|けれども|ませんか||
|ja-gram-n5-n5-limit-dake-fill-0|ローマ字{___}書けます。<br>(I can only write romaji.)|だけ|は〜より|がほしい|そして||
|ja-gram-n5-n5-limit-dake-fill-1|最近は職場{___}でなく家庭においてもパソコンが使われている。<br>(The personal computer is used not only at the office but also at home recently.)|だけ|いちばん|に|を||
|ja-gram-n5-n5-limit-dake-fill-2|一つ{___}ください。<br>(Please give me just one.)|だけ|の中で〜が一番|がいる|でも||
|ja-gram-n5-n5-limit-dake-fill-3|少し{___}食べます。<br>(I'll eat just a little.)|だけ|か|まだ|けれども||
|ja-gram-n5-n5-limit-dake-fill-4|あなた{___}が知っています。<br>(Only you know.)|だけ|で|も|に||
|ja-gram-n5-n5-particle-de-fill-0|車{___}来ました。<br>(I came by car.)|で|の|と|が||
|ja-gram-n5-n5-particle-de-fill-1|ペン{___}書く。<br>(I write with a pen.)|で|それから|がある|けど||
|ja-gram-n5-n5-particle-de-fill-2|食料品店{___}それを買いました。<br>(I bought it at the grocer's shop.)|で|いっしょに|けど|が||
|ja-gram-n5-n5-particle-de-fill-3|ひとり{___}行きますか。<br>(Are you going by yourself?)|で|つもり|の|と||
|ja-gram-n5-n5-particle-de-fill-4|図書館{___}勉強します。<br>(I study at the library.)|で|だろう|を|前に||
|ja-gram-n5-n5-particle-de-mo-fill-0|高いです。{___}、買います。<br>(It is expensive. But I will buy it.)|でも|も|けれども|だけ||
|ja-gram-n5-n5-particle-de-mo-fill-1|疲れました。{___}、まだ仕事があります。<br>(I am tired. But there is still work to do.)|でも|の|が|けど||
|ja-gram-n5-n5-particle-de-mo-fill-2|雨が降っています。{___}、出かけます。<br>(It is raining. But I will go out.)|でも|に|なくてはならない|てある||
|ja-gram-n5-n5-particle-de-mo-fill-3|日本語は難しいです。{___}、楽しいです。<br>(Japanese is difficult. But it is fun.)|でも|まだ|と思う|けれども||
|ja-gram-n5-n5-particle-ga-contrast-fill-0|突然です{___}ボードゲーム告知をてっきり忘れてました。<br>(This is out of nowhere but I completely forgot about the board game notice.)|が|で|いっしょに|のが下手|LENGTH_TELL|
|ja-gram-n5-n5-particle-ga-contrast-fill-1|悪いです{___}ちょっと静かにしてください。<br>(Sorry but could you keep it a little quieter?)|が|を|ましょうか|も||
|ja-gram-n5-n5-particle-ga-contrast-fill-2|料理はあまりおいしくなかった{___}、その他の点では、そのパーティーは成功だった。<br>(The dishes were not so delicious, but otherwise the party was a success.)|が|しかし|だけ|たい||
|ja-gram-n5-n5-particle-ga-contrast-fill-3|行きたいです{___}、時間がありません。<br>(I want to go, but I don't have time.)|が|方|や|しかし|SELF_ANSWERING|
|ja-gram-n5-n5-particle-ga-subject-fill-0|バス{___}来るよ。<br>(The bus is coming!)|が|で|まで|すぎる||
|ja-gram-n5-n5-particle-ga-subject-fill-1|台所にテレビ{___}あります。<br>(There is a television in the kitchen.)|が|に|は|がいる||
|ja-gram-n5-n5-particle-ga-subject-fill-2|日本語{___}できます。<br>(I can speak Japanese.)|が|より〜ほうが|前に|がある|LENGTH_TELL|
|ja-gram-n5-n5-particle-ga-subject-fill-3|猫{___}好きです。<br>(I like cats.)|が|てから|で|がある||
|ja-gram-n5-n5-particle-ga-subject-fill-4|だれ{___}来ましたか。<br>(Who came?)|が|お|や|は||
|ja-gram-n5-n5-particle-he-fill-0|学校{___}行きます。<br>(I go to school.)|へ|まで|は|に行く||
|ja-gram-n5-n5-particle-he-fill-1|日本{___}来ました。<br>(I came to Japan.)|へ|か|いちばん|もう||
|ja-gram-n5-n5-particle-he-fill-2|家{___}帰ります。<br>(I return home.)|へ|が|から|方||
|ja-gram-n5-n5-particle-he-fill-3|どこ{___}行きますか。<br>(Where are you going?)|へ|まだ|は|を||
|ja-gram-n5-n5-particle-ka-or-fill-0|コーヒー{___}紅茶を飲みますか。<br>(Will you drink coffee or tea?)|か|それから|が|で|SELF_ANSWERING|
|ja-gram-n5-n5-particle-ka-or-fill-1|月曜日{___}火曜日に来てください。<br>(Please come on Monday or Tuesday.)|か|や|から|が||
|ja-gram-n5-n5-particle-ka-or-fill-2|バス{___}電車で行きます。<br>(I will go by bus or train.)|か|は|けど|も||
|ja-gram-n5-n5-particle-ka-or-fill-3|日本語{___}英語で書いてください。<br>(Please write in Japanese or English.)|か|まだ|に|それから||
|ja-gram-n5-n5-particle-kara-from-fill-0|私はアメリカ{___}来ました。<br>(I came from America.)|から|に|や|ので||
|ja-gram-n5-n5-particle-kara-from-fill-1|学校は九時{___}始まります。<br>(School starts from nine o'clock.)|から|を|それから|か〜か||
|ja-gram-n5-n5-particle-kara-from-fill-2|東京{___}大阪まで新幹線で行きます。<br>(I go from Tokyo to Osaka by Shinkansen.)|から|ので|が|まだ||
|ja-gram-n5-n5-particle-kara-from-fill-3|子供の頃{___}日本語を勉強しています。<br>(I have been studying Japanese since childhood.)|から|けど|は|前に||
|ja-gram-n5-n5-particle-made-fill-0|私は東京から九州{___}飛行機で行きました。<br>(I took an airplane from Tokyo to Kyushu.)|まで|いっしょに|のが下手|が||
|ja-gram-n5-n5-particle-made-fill-1|１０時{___}起きてた。<br>(I stayed up till 10pm.)|まで|だ|と|いちばん||
|ja-gram-n5-n5-particle-made-fill-2|私は昼{___}に手紙を書き終えた。<br>(I finished writing the letter by noon.)|まで|いちばん|たい|より〜ほうが||
|ja-gram-n5-n5-particle-made-fill-3|おまけに雨{___}降っていた。<br>(To top things off it was even raining.)|まで|が|ないでください|前に||
|ja-gram-n5-n5-particle-made-fill-4|駅{___}歩きます。<br>(I walk to the station.)|まで|が|か|しかし||
|ja-gram-n5-n5-particle-mo-fill-0|これ{___}私のです。<br>(This is also mine.)|も|だろう|に|は〜より||
|ja-gram-n5-n5-particle-mo-fill-1|あなた{___}ジャズが好きですか？<br>(Do you also like jazz?)|も|すぎる|いちばん|たい||
|ja-gram-n5-n5-particle-mo-fill-2|あの小さいの{___}わたしのです。<br>(That small one is also mine.)|も|でも|まで|ないでください|LENGTH_TELL|
|ja-gram-n5-n5-particle-mo-fill-3|私{___}日本語を勉強しています。<br>(I am also studying Japanese.)|も|を|に|まで||
|ja-gram-n5-n5-particle-mo-fill-4|田中さん{___}来ますか。<br>(Will Tanaka-san come too?)|も|まだ|けれども|に||
|ja-gram-n5-n5-particle-ni-he-fill-0|駅{___}（へ）行きます。<br>(I go to the station. (に and へ interchangeable here))|に|ここ|か〜か|や|SELF_ANSWERING|
|ja-gram-n5-n5-particle-ni-he-fill-1|友達の家{___}（へ）来てください。<br>(Please come to my friend's house.)|に|そして|けれども|や||
|ja-gram-n5-n5-particle-ni-he-fill-2|北海道{___}（へ）旅行したいです。<br>(I want to travel to Hokkaido.)|に|で|いっしょに|そして||
|ja-gram-n5-n5-particle-ni-indirect-fill-0|これは母{___}貰いました。<br>(I got this from my mother.)|に|を|の|が||
|ja-gram-n5-n5-particle-ni-indirect-fill-1|そこ{___}着いたら私に教えてください。<br>(Please let me know when we get there.)|に|から|お|が|SELF_ANSWERING|
|ja-gram-n5-n5-particle-ni-indirect-fill-2|私はあなた{___}りんごをあげる。<br>(I will give an apple to you.)|に|前に|けど|が||
|ja-gram-n5-n5-particle-ni-indirect-fill-3|私はともだち{___}電話をします。<br>(I will call a friend.)|に|ので|そして|なる||
|ja-gram-n5-n5-particle-ni-indirect-fill-4|彼は先生{___}しかられた。<br>(He got scolded by the teacher.)|に|から|ので|どうやって||
|ja-gram-n5-n5-particle-ni-location-fill-0|その車のなか{___}犬がいます。<br>(There is a dog in that car.)|に|そして|しかし|が||
|ja-gram-n5-n5-particle-ni-location-fill-1|１０時{___}約束があります。<br>(I have an appointment at ten.)|に|より〜ほうが|の|すぎる|LENGTH_TELL|
|ja-gram-n5-n5-particle-ni-location-fill-2|２時{___}空港に見送りに行きます。<br>(I'm going to see her off at the airport at 2:00.)|に|で|が|も|SELF_ANSWERING|
|ja-gram-n5-n5-particle-ni-location-fill-3|きっかり９時{___}来なさい。<br>(Come at nine o'clock sharp.)|に|じゃない|で|前に||
|ja-gram-n5-n5-particle-ni-location-fill-4|東京{___}行きます。<br>(I go to Tokyo.)|に|前に|がいる|から||
|ja-gram-n5-n5-particle-no-fill-0|フレッド君{___}車はどこにありますか。<br>(Where is Fred's car?)|の|まで|いちばん|のが好き|LENGTH_TELL|
|ja-gram-n5-n5-particle-no-fill-1|「これは誰{___}ペン？」「私の。」<br>("Whose pen is this?" "Mine.")|の|の中で〜が一番|なる|か〜か|SELF_ANSWERING, LENGTH_TELL|
|ja-gram-n5-n5-particle-no-fill-2|リリー{___}靴はどこにあるか知りません。<br>(I don't know where Lilly's shoes are.)|の|へ|に|たことがある||
|ja-gram-n5-n5-particle-no-fill-3|これは私{___}本です。<br>(This is my book.)|の|だけ|けれども|と||
|ja-gram-n5-n5-particle-no-fill-4|日本{___}食べ物が好きです。<br>(I like Japanese food.)|の|いつも|や|なる||
|ja-gram-n5-n5-particle-to-fill-0|パン{___}ミルクを買いました。<br>(I bought bread and milk.)|と|に行く|に|から||
|ja-gram-n5-n5-particle-to-fill-1|友達{___}映画を見ました。<br>(I watched a movie with a friend.)|と|お|か〜か|まだ||
|ja-gram-n5-n5-particle-to-fill-2|彼は「行く」{___}言いました。<br>(He said "I will go.")|と|と思う|から|より〜ほうが|LENGTH_TELL|
|ja-gram-n5-n5-particle-to-fill-3|春になる{___}桜が咲きます。<br>(When spring comes, the cherry blossoms bloom.)|と|いつも|ない|けれども||
|ja-gram-n5-n5-particle-wa-fill-0|私{___}学生です。<br>(I am a student.)|は|てある|まだ|か〜か||
|ja-gram-n5-n5-particle-wa-fill-1|これ{___}本です。<br>(This is a book.)|は|が|か〜か|ないといけない|LENGTH_TELL|
|ja-gram-n5-n5-particle-wa-fill-2|田中さん{___}先生ですか。<br>(Is Tanaka-san a teacher?)|は|と|ので|は〜より||
|ja-gram-n5-n5-particle-wa-fill-3|今日{___}月曜日です。<br>(Today is Monday.)|は|けど|お|だけ||
|ja-gram-n5-n5-particle-wa-fill-4|猫{___}魚が好きです。<br>(Cats like fish.)|は|より〜ほうが|は〜より|がある|LENGTH_TELL|
|ja-gram-n5-n5-particle-wo-fill-0|新しいカメラ{___}買った。<br>(I bought a new camera.)|を|より〜ほうが|で|なる||
|ja-gram-n5-n5-particle-wo-fill-1|それ{___}ください。<br>(That one, please.)|を|でも|いちばん|もう||
|ja-gram-n5-n5-particle-wo-fill-2|私はチキン{___}もらいます。<br>(I'll have chicken.)|を|だけ|と|で||
|ja-gram-n5-n5-particle-wo-fill-3|彼は「イマジン」{___}歌いました。<br>(He sang "Imagine".)|を|で|ないといけない|でも|LENGTH_TELL|
|ja-gram-n5-n5-particle-wo-fill-4|仕事{___}探している。<br>(I'm looking for a job.)|を|は|の中で〜が一番|だろう|LENGTH_TELL|
|ja-gram-n5-n5-particle-ya-fill-0|机の上に本{___}ノートがあります。<br>(There are books and notebooks (among other things) on the desk.)|や|が|と|いつも||
|ja-gram-n5-n5-particle-ya-fill-1|冷蔵庫に野菜{___}果物などが入っています。<br>(There are vegetables, fruit, and such in the refrigerator.)|や|と思う|は|から||
|ja-gram-n5-n5-particle-ya-fill-2|バッグの中に財布{___}カギがあります。<br>(In my bag there is a wallet and keys (and other things).)|や|で|は|に||
|ja-gram-n5-n5-particle-ya-fill-3|日本語{___}英語を勉強しています。<br>(I am studying Japanese and English (among other things).)|や|それから|へ|まだ||
|ja-gram-n5-n5-reason-kara-fill-0|面接に行く{___}はげましてください。<br>(I'm going to an interview so please encourage me.)|から|を|だろう|に||
|ja-gram-n5-n5-reason-kara-fill-1|あの日帰ったのは体調が悪かった{___}です。<br>(It is because I was not feeling well that I went home that day.)|から|なくてはいけない|で|が||
|ja-gram-n5-n5-reason-kara-fill-2|昨夜病気だ{___}、眠れなかった。<br>(Because I was sick, I couldn't sleep last night.)|から|は〜より|いちばん|が||
|ja-gram-n5-n5-reason-kara-fill-3|ああ、ゆっくりやって下さい。急ぎません{___}。<br>(Oh, take your time. I'm in no hurry.)|から|いちばん|じゃない|の||
|ja-gram-n5-n5-reason-kara-fill-4|雨が降っている{___}、傘を持っていきます。<br>(Because it is raining, I will bring an umbrella.)|から|に|と|だけ||
|ja-gram-n5-n5-reason-node-fill-0|疲れた{___}、早く寝ます。<br>(Since I am tired, I will sleep early.)|ので|が|ほうがいい|そして||
|ja-gram-n5-n5-reason-node-fill-1|雨が降っている{___}、傘を持ってください。<br>(Since it is raining, please take an umbrella.)|ので|を|それから|すぎる||
|ja-gram-n5-n5-reason-node-fill-2|明日試験がある{___}、今夜勉強します。<br>(Since there is an exam tomorrow, I will study tonight.)|ので|たい|も|で||
|ja-gram-n5-n5-reason-node-fill-3|寒い{___}、窓を閉めてください。<br>(It is cold, so please close the window.)|ので|か|へ|か〜か||
|ja-gram-n5-n5-time-mae-ni-fill-0|寝る{___}歯を磨きます。<br>(I brush my teeth before going to sleep.)|前に|てから|いくら|もう||
|ja-gram-n5-n5-time-mae-ni-fill-1|食事の{___}手を洗います。<br>(I wash my hands before meals.)|前に|まだ〜ていません|てから|な||
|ja-gram-n5-n5-time-mae-ni-fill-2|日本に来る{___}日本語を勉強しました。<br>(I studied Japanese before coming to Japan.)|前に|ちゃいけない|てから|そして||
|ja-gram-n5-n5-time-mae-ni-fill-3|授業が始まる{___}準備してください。<br>(Please prepare before class starts.)|前に|に|すぎる|もう||

## Pool: `question_word` (22 facts)

| Fact ID | Question | Correct | D1 | D2 | D3 | Flags |
|---|---|---|---|---|---|---|
|ja-gram-n5-n5-qw-donna-fill-0|{___}音楽が好きですか。<br>(What kind of music do you like?)|どんな|がいる|をください|何||
|ja-gram-n5-n5-qw-donna-fill-1|{___}人ですか。<br>(What kind of person is they?)|どんな|か〜か|しかし|いくら||
|ja-gram-n5-n5-qw-donna-fill-2|{___}食べ物が好きですか。<br>(What kind of food do you like?)|どんな|いくら|何|もう||
|ja-gram-n5-n5-qw-donna-fill-3|{___}映画を見ますか。<br>(What kind of movies do you watch?)|どんな|まで|か|何||
|ja-gram-n5-n5-qw-doshite-fill-0|{___}学校に来なかったのですか。<br>(Why didn't you come to school?)|どうして|何|どんな|いくら||
|ja-gram-n5-n5-qw-doshite-fill-1|{___}泣いているの？<br>(Why are you crying?)|どうして|が|か|がある||
|ja-gram-n5-n5-qw-doshite-fill-2|{___}日本語を勉強していますか。<br>(Why are you studying Japanese?)|どうして|何|いちばん|いくら||
|ja-gram-n5-n5-qw-doshite-fill-3|{___}遅れましたか。<br>(Why were you late?)|どうして|の|いくら|がほしい||
|ja-gram-n5-n5-qw-douyatte-fill-0|駅まで{___}行きますか。<br>(How do you get to the station?)|どうやって|すぎる|や|ちゃいけない||
|ja-gram-n5-n5-qw-douyatte-fill-1|{___}作りますか。<br>(How do you make it?)|どうやって|何|てはいけない|のが上手||
|ja-gram-n5-n5-qw-douyatte-fill-2|日本語は{___}勉強しましたか。<br>(How did you study Japanese?)|どうやって|何|まで|いくら||
|ja-gram-n5-n5-qw-douyatte-fill-3|{___}使うか分かりますか。<br>(Do you know how to use it?)|どうやって|これ|てください|何||
|ja-gram-n5-n5-qw-ikura-fill-0|葉書は{___}ですか。<br>(How much for a postcard?)|幾ら|ので|何|が||
|ja-gram-n5-n5-qw-ikura-fill-1|{___}お金をもってますか。<br>(How much money do you have with you?)|いくら|どうやって|に|何||
|ja-gram-n5-n5-qw-ikura-fill-2|このＴシャツの値段は{___}ですか。<br>(How much is this T-shirt?)|いくら|けど|よ|なくてもいい||
|ja-gram-n5-n5-qw-ikura-fill-3|「それは{___}かかりましたか。」「１０００円かかりました。」<br>("How much did it cost?" "It cost me a thousand yen.")|いくら|どうして|の|何||
|ja-gram-n5-n5-qw-ikura-fill-4|これは{___}ですか。<br>(How much is this?)|いくら|なくてはいけない|どうやって|がほしい||
|ja-gram-n5-n5-qw-nani-fill-0|{___}にしますか。<br>(What will you have?)|何|てから|どうやって|なる|LENGTH_TELL, SHORT_EXPLANATION|
|ja-gram-n5-n5-qw-nani-fill-1|{___}の用ですか。<br>(What is your business here?)|何|どうやって|が|どうして|LENGTH_TELL, SHORT_EXPLANATION|
|ja-gram-n5-n5-qw-nani-fill-2|この花は英語で{___}（なん）と言いますか。<br>(What do you call this flower in English?)|何|で|どんな|ほうがいい||
|ja-gram-n5-n5-qw-nani-fill-3|この箱の中に{___}がありますか。<br>(What is in this box?)|何|いくら|も|どんな||
|ja-gram-n5-n5-qw-nani-fill-4|あなたの好きな食べ物は{___}ですか。<br>(What is your favourite food?)|何|どんな|の|どうやって||

## Pool: `sentence_ender` (60 facts)

| Fact ID | Question | Correct | D1 | D2 | D3 | Flags |
|---|---|---|---|---|---|---|
|ja-gram-n5-n5-conj-kedo-fill-0|行きたい{___}、お金がない。<br>(I want to go, but I don't have money.)|けど|が|しかし|いつも||
|ja-gram-n5-n5-conj-kedo-fill-1|日本語は難しい{___}、楽しいです。<br>(Japanese is difficult, but it's fun.)|けど|だろう|か〜か|しかし||
|ja-gram-n5-n5-conj-kedo-fill-2|すみません{___}、時間はありますか。<br>(Excuse me, but do you have a moment?)|けど|は|だろう|か〜か||
|ja-gram-n5-n5-conj-kedo-fill-3|暑い{___}、窓を開けないでください。<br>(It's hot, but please don't open the window.)|けど|へ|で|この||
|ja-gram-n5-n5-conj-keredomo-fill-0|行きたい{___}、時間がありません。<br>(I want to go, however I do not have time.)|けれども|でも|が|がある||
|ja-gram-n5-n5-conj-keredomo-fill-1|努力した{___}、うまくいきませんでした。<br>(I made an effort, however it did not go well.)|けれども|が|でも|で||
|ja-gram-n5-n5-conj-keredomo-fill-2|申し訳ありません{___}、少しお時間をいただけますか。<br>(I am sorry, however could I have a moment of your time?)|けれども|に|まで|や||
|ja-gram-n5-n5-conj-shikashi-fill-0|雨が降っていた。{___}、試合は続いた。<br>(It was raining. However, the game continued.)|しかし|んです|でも|けど||
|ja-gram-n5-n5-conj-shikashi-fill-1|彼は頑張った。{___}、失敗した。<br>(He tried hard. However, he failed.)|しかし|いつも|なる|それから||
|ja-gram-n5-n5-conj-shikashi-fill-2|高かった。{___}、買いました。<br>(It was expensive. However, I bought it.)|しかし|ないでください|けど|が||
|ja-gram-n5-n5-conj-shikashi-fill-3|日本語は難しい。{___}、おもしろい。<br>(Japanese is difficult. However, it is interesting.)|しかし|まだ|でも|けれども||
|ja-gram-n5-n5-conj-sorekara-fill-0|朝ご飯を食べました。{___}、学校へ行きました。<br>(I ate breakfast. Then I went to school.)|それから|まで|より〜ほうが|ね||
|ja-gram-n5-n5-conj-sorekara-fill-1|シャワーを浴びて、{___}寝ます。<br>(I take a shower, and after that go to sleep.)|それから|まだ|は|しかし||
|ja-gram-n5-n5-conj-sorekara-fill-2|宿題をします。{___}、テレビを見ます。<br>(I will do homework. Then I will watch TV.)|それから|を|けれども|まで||
|ja-gram-n5-n5-conj-soshite-fill-0|彼は背が高い。{___}、頭もいい。<br>(He is tall. And also smart.)|そして|じゃない|で|に||
|ja-gram-n5-n5-conj-soshite-fill-1|窓を開けた。{___}、椅子に座った。<br>(I opened the window. Then I sat in the chair.)|そして|もう|それから|へ||
|ja-gram-n5-n5-conj-soshite-fill-2|日本語を勉強した。{___}、日本に行った。<br>(I studied Japanese. And then I went to Japan.)|そして|は|で|てはいけない||
|ja-gram-n5-n5-conj-soshite-fill-3|朝ごはんを食べました。{___}、学校に行きました。<br>(I ate breakfast. And then, I went to school.)|そして|まだ|の|へ||
|ja-gram-n5-n5-copula-da-fill-0|私は学生{___}。<br>(I am a student.)|です|だろう|に|よ||
|ja-gram-n5-n5-copula-da-fill-1|これは猫{___}。<br>(This is a cat.)|だ|でしょう|じゃない|か||
|ja-gram-n5-n5-copula-da-fill-2|彼は医者{___}。<br>(He is a doctor.)|です|でしょう|だろう|んです||
|ja-gram-n5-n5-copula-da-fill-3|今日は暑い{___}ね。<br>(It's hot today, isn't it.)|です|から|か|よ||
|ja-gram-n5-n5-copula-da-fill-4|あの人は田中さん{___}か。<br>(Is that person Tanaka-san?)|です|がある|んです|だろう||
|ja-gram-n5-n5-copula-darou-fill-0|明日は雨{___}。<br>(It will probably rain tomorrow.)|だろう|か|よ|でしょう||
|ja-gram-n5-n5-copula-darou-fill-1|彼はもう寝た{___}。<br>(He has probably already gone to sleep.)|だろう|か|じゃない|のが下手||
|ja-gram-n5-n5-copula-darou-fill-2|これは難しい{___}。<br>(This is probably difficult.)|だろう|でしょう|んです|を||
|ja-gram-n5-n5-copula-darou-fill-3|試験に合格した{___}。<br>(I probably passed the exam.)|だろう|ね|よ|か||
|ja-gram-n5-n5-copula-deshou-fill-0|明日は晴れ{___}。<br>(It will probably be sunny tomorrow.)|でしょう|だろう|を|だ||
|ja-gram-n5-n5-copula-deshou-fill-1|それは田中さんの傘{___}？<br>(That's Tanaka-san's umbrella, right?)|でしょう|はどうですか|だろう|か||
|ja-gram-n5-n5-copula-deshou-fill-2|もうすぐ来る{___}。<br>(They will probably come soon.)|でしょう|ね|だ|はどうですか||
|ja-gram-n5-n5-copula-deshou-fill-3|難しい{___}ね。<br>(It's probably difficult, isn't it.)|でしょう|も|じゃない|んです||
|ja-gram-n5-n5-copula-janai-fill-0|これは本{___}。<br>(This is not a book.)|じゃない|よ|ね|だ|LENGTH_TELL|
|ja-gram-n5-n5-copula-janai-fill-1|彼は先生{___}。<br>(He is not a teacher.)|ではありません|と|よ|でしょう|LENGTH_TELL|
|ja-gram-n5-n5-copula-janai-fill-2|今日は月曜日{___}ですよ。<br>(Today is not Monday, you know.)|じゃない|だ|なくてはならない|それから||
|ja-gram-n5-n5-copula-janai-fill-3|私の問題{___}。<br>(It is not my problem.)|ではない|か|なくちゃ|よ||
|ja-gram-n5-n5-copula-janai-fill-4|これは私の{___}。<br>(This is not mine.)|じゃありません|だ|もう|よ|LENGTH_TELL|
|ja-gram-n5-n5-exp-n-desu-fill-0|どうして泣いている{___}か。<br>(Why are you crying? (seeking explanation))|んです|だろう|じゃない|はどうですか||
|ja-gram-n5-n5-exp-n-desu-fill-1|実は、道に迷った{___}。<br>(The truth is, I got lost.)|んです|でしょう|けど|じゃない||
|ja-gram-n5-n5-exp-n-desu-fill-2|頭が痛い{___}。<br>(I have a headache. (explaining))|んです|だ|ね|じゃない||
|ja-gram-n5-n5-exp-n-desu-fill-3|どこへ行く{___}か。<br>(Where are you going? (curious/seeking explanation))|んです|だ|か|じゃない||
|ja-gram-n5-n5-honor-o-go-fill-0|{___}水をください。<br>(Please give me some water.)|お|もう|の|だ||
|ja-gram-n5-n5-honor-o-go-fill-1|ご家族は{___}元気ですか。<br>(Is your family doing well?)|お|が|も|は||
|ja-gram-n5-n5-honor-o-go-fill-2|{___}名前は何ですか。<br>(What is your name?)|お|はどうですか|もう|の中で〜が一番|LENGTH_TELL|
|ja-gram-n5-n5-honor-o-go-fill-3|{___}ちそうさまでした。<br>(Thank you for the meal.)|ご|もう|は|前に||
|ja-gram-n5-n5-inv-dou-desu-ka-fill-0|コーヒー{___}。<br>(How about some coffee?)|はどうですか|じゃない|よ|てはいけない||
|ja-gram-n5-n5-inv-dou-desu-ka-fill-1|明日{___}。<br>(How about tomorrow?)|はどうですか|んです|だ|か|LENGTH_TELL|
|ja-gram-n5-n5-inv-dou-desu-ka-fill-2|日本語の勉強{___}。<br>(How is your Japanese study going?)|はどうですか|だ|だろう|ね|LENGTH_TELL|
|ja-gram-n5-n5-inv-dou-desu-ka-fill-3|散歩してみて{___}。<br>(How about trying a walk?)|はどうですか|だ|だろう|なくてもいい||
|ja-gram-n5-n5-particle-ka-fill-0|これは本です{___}。<br>(Is this a book?)|か|ね|じゃない|よ||
|ja-gram-n5-n5-particle-ka-fill-1|日本語が分かります{___}。<br>(Do you understand Japanese?)|か|じゃない|よ|だろう|SELF_ANSWERING|
|ja-gram-n5-n5-particle-ka-fill-2|どこに行きます{___}。<br>(Where are you going?)|か|よ|だろう|より〜ほうが|LENGTH_TELL|
|ja-gram-n5-n5-particle-ka-fill-3|今日は忙しいです{___}。<br>(Are you busy today?)|か|よ|はどうですか|どんな|LENGTH_TELL|
|ja-gram-n5-n5-sfp-ne-fill-0|今日はいい天気です{___}。<br>(It's nice weather today, isn't it.)|ね|てある|はどうですか|だろう|LENGTH_TELL|
|ja-gram-n5-n5-sfp-ne-fill-1|この映画、面白いです{___}。<br>(This movie is interesting, isn't it.)|ね|だ|よ|はどうですか||
|ja-gram-n5-n5-sfp-ne-fill-2|田中さんは日本人です{___}。<br>(Tanaka-san is Japanese, right.)|ね|だ|でしょう|よ||
|ja-gram-n5-n5-sfp-ne-fill-3|明日また来ます{___}。<br>(I'll come again tomorrow, okay.)|ね|へ|んです|はどうですか|LENGTH_TELL|
|ja-gram-n5-n5-sfp-yo-fill-0|バスが来ました{___}。<br>(The bus has come, you know.)|よ|か|んです|ね||
|ja-gram-n5-n5-sfp-yo-fill-1|これは危ないです{___}。<br>(This is dangerous, I'm telling you.)|よ|はどうですか|を|んです|LENGTH_TELL|
|ja-gram-n5-n5-sfp-yo-fill-2|もうすぐ着きます{___}。<br>(We'll arrive soon, I assure you.)|よ|が|ね|じゃない||
|ja-gram-n5-n5-sfp-yo-fill-3|あのお店は美味しいです{___}。<br>(That restaurant is delicious, I'm telling you.)|よ|じゃない|でしょう|なくてはならない|LENGTH_TELL|

## Pool: `verb_form` (149 facts)

| Fact ID | Question | Correct | D1 | D2 | D3 | Flags |
|---|---|---|---|---|---|---|
|ja-gram-n5-n5-comp-no-naka-de-ichiban-fill-0|果物{___}りんごが一番好きです。<br>(Among fruits, I like apples the best.)|の中で|か〜か|も|から||
|ja-gram-n5-n5-comp-no-naka-de-ichiban-fill-1|クラス{___}田中さんが一番背が高いです。<br>(In the class, Tanaka-san is the tallest.)|の中で|しかし|と|すぎる||
|ja-gram-n5-n5-comp-no-naka-de-ichiban-fill-2|季節{___}春が一番好きです。<br>(Among the seasons, I like spring the best.)|の中で|や|まだ|の||
|ja-gram-n5-n5-comp-no-naka-de-ichiban-fill-3|日本の山{___}富士山が一番高いです。<br>(Among Japan's mountains, Mt. Fuji is the tallest.)|の中で|でも|じゃない|から||
|ja-gram-n5-n5-comp-wa-yori-fill-0|東京は大阪{___}大きいです。<br>(Tokyo is bigger than Osaka.)|より|いっしょに|ませんか|いつも||
|ja-gram-n5-n5-comp-wa-yori-fill-1|夏は冬{___}好きです。<br>(I like summer more than winter.)|より|たことがある|けれども|が||
|ja-gram-n5-n5-comp-wa-yori-fill-2|電車はバス{___}速いです。<br>(The train is faster than the bus.)|より|に|いつも|そして||
|ja-gram-n5-n5-comp-wa-yori-fill-3|今日は昨日{___}暑いです。<br>(It is hotter today than yesterday.)|より|へ|に|で||
|ja-gram-n5-n5-comp-yori-hou-ga-fill-0|バス{___}電車のほうが速いです。<br>(The train is faster than the bus.)|より|もう|から|も||
|ja-gram-n5-n5-comp-yori-hou-ga-fill-1|肉{___}魚のほうが好きです。<br>(I like fish more than meat.)|より|も|いつも|から||
|ja-gram-n5-n5-comp-yori-hou-ga-fill-2|テレビ{___}読書のほうが楽しいです。<br>(Reading is more enjoyable than watching TV.)|より|に|が|を||
|ja-gram-n5-n5-comp-yori-hou-ga-fill-3|大阪{___}東京のほうが高い。<br>(Tokyo is more expensive than Osaka.)|より|は〜より|か|ちゃいけない||
|ja-gram-n5-n5-intent-tsumori-fill-0|来年日本に行く{___}です。<br>(I plan to go to Japan next year.)|つもり|たい|てから|に||
|ja-gram-n5-n5-intent-tsumori-fill-1|大学で日本語を勉強する{___}です。<br>(I intend to study Japanese at university.)|つもり|がほしい|たい|に||
|ja-gram-n5-n5-intent-tsumori-fill-2|お酒を飲まない{___}です。<br>(I don't intend to drink alcohol.)|つもり|すぎる|がほしい|方||
|ja-gram-n5-n5-intent-tsumori-fill-3|何をする{___}ですか。<br>(What do you plan to do?)|つもり|がほしい|ましょうか|も||
|ja-gram-n5-n5-inv-masen-ka-fill-0|一緒に映画を見{___}。<br>(Won't you watch a movie with me?)|ませんか|たい|か|も||
|ja-gram-n5-n5-inv-masen-ka-fill-1|コーヒーを飲み{___}。<br>(Won't you have some coffee?)|ませんか|がいる|なくてもいい|に行く||
|ja-gram-n5-n5-inv-masen-ka-fill-2|明日、公園に行き{___}。<br>(Would you like to go to the park tomorrow?)|ませんか|ないでください|方|てください||
|ja-gram-n5-n5-inv-masen-ka-fill-3|一緒に歌い{___}。<br>(Won't you sing with me?)|ませんか|ちゃいけない|んです|ている||
|ja-gram-n5-n5-inv-mashou-fill-0|一緒に行き{___}。<br>(Let's go together.)|ましょう|てある|方|のが上手||
|ja-gram-n5-n5-inv-mashou-fill-1|もう寝{___}。<br>(Let's go to sleep now.)|ましょう|なる|そして|たり〜たり||
|ja-gram-n5-n5-inv-mashou-fill-2|日本語で話し{___}。<br>(Let's speak in Japanese.)|ましょう|ちゃいけない|か|たい||
|ja-gram-n5-n5-inv-mashou-fill-3|休憩し{___}。<br>(Let's take a break.)|ましょう|なる|すぎる|ちゃいけない||
|ja-gram-n5-n5-inv-mashou-ka-fill-0|窓を開け{___}。<br>(Shall I open the window?)|ましょうか|から|に行く|てはいけない||
|ja-gram-n5-n5-inv-mashou-ka-fill-1|手伝い{___}。<br>(Shall I help you?)|ましょうか|なくてはいけない|も|てから||
|ja-gram-n5-n5-inv-mashou-ka-fill-2|何か飲み{___}。<br>(Shall we drink something?)|ましょうか|だろう|なくちゃ|てある||
|ja-gram-n5-n5-inv-mashou-ka-fill-3|タクシーを呼び{___}。<br>(Shall I call a taxi?)|ましょうか|方|が|のが好き||
|ja-gram-n5-n5-must-naito-ikenai-fill-0|急が{___}。<br>(I have to hurry.)|ないといけない|なくてはいけない|なくてはならない|ほうがいい||
|ja-gram-n5-n5-must-naito-ikenai-fill-1|もっと勉強し{___}ね。<br>(I need to study more, don't I.)|ないといけない|なくちゃ|のが下手|てから||
|ja-gram-n5-n5-must-naito-ikenai-fill-2|明日早く起き{___}。<br>(I have to get up early tomorrow.)|ないといけない|なくてはいけない|を|のが上手||
|ja-gram-n5-n5-must-naito-ikenai-fill-3|電話し{___}。<br>(I need to make a phone call.)|ないといけない|で|ないでください|なくてはいけない||
|ja-gram-n5-n5-must-nakereba-naranai-fill-0|毎日薬を飲ま{___}。<br>(I must take medicine every day.)|なくてはいけません|ましょう|のが好き|ましょうか||
|ja-gram-n5-n5-must-nakereba-naranai-fill-1|明日までにレポートを出さ{___}。<br>(I must hand in my report by tomorrow.)|なくてはいけない|ないでください|たり〜たり|や||
|ja-gram-n5-n5-must-nakereba-naranai-fill-2|早く起き{___}。<br>(I have to wake up early.)|なくてはいけません|けれども|ないといけない|ちゃいけない||
|ja-gram-n5-n5-must-nakereba-naranai-fill-3|日本語を練習し{___}。<br>(I have to practice Japanese.)|なくてはいけません|まで|ほうがいい|たい||
|ja-gram-n5-n5-must-nakucha-fill-0|もう行か{___}。<br>(I gotta go now.)|なくちゃ|だ|いっしょに|すぎる||
|ja-gram-n5-n5-must-nakucha-fill-1|宿題をやら{___}。<br>(I gotta do my homework.)|なくちゃ|に|ないといけない|よ||
|ja-gram-n5-n5-must-nakucha-fill-2|早く起き{___}。<br>(Gotta get up early.)|なくちゃ|と|てある|なくてはならない||
|ja-gram-n5-n5-must-nakucha-fill-3|電池を変え{___}。<br>(Gotta change the batteries.)|なくちゃ|なくてはいけない|ないといけない|に||
|ja-gram-n5-n5-must-nakute-mo-ii-fill-0|今日は来{___}ですよ。<br>(You don't have to come today.)|なくてもいい|ている|たり〜たり|てはいけない||
|ja-gram-n5-n5-must-nakute-mo-ii-fill-1|全部食べ{___}です。<br>(You don't have to eat everything.)|なくてもいい|なくちゃ|たり〜たり|方||
|ja-gram-n5-n5-must-nakute-mo-ii-fill-2|急が{___}です。<br>(You don't have to hurry.)|なくてもいい|に行く|てもいい|がある||
|ja-gram-n5-n5-must-nakute-mo-ii-fill-3|スーツを着{___}ですよ。<br>(You don't need to wear a suit.)|なくてもいい|のが好き|なる|なくてはならない||
|ja-gram-n5-n5-must-nakute-naranai-fill-0|規則を守ら{___}。<br>(One must follow the rules.)|なくてはならない|ましょうか|なくてはいけない|てもいい||
|ja-gram-n5-n5-must-nakute-naranai-fill-1|人は食べ{___}。<br>(People must eat.)|なくてはならない|まだ〜ていません|は|てある||
|ja-gram-n5-n5-must-nakute-naranai-fill-2|試験に合格し{___}。<br>(I must pass the exam.)|なくてはならない|てある|のが下手|いくら||
|ja-gram-n5-n5-must-nakute-naranai-fill-3|もっと努力し{___}。<br>(I must make more effort.)|なくてはならない|なくてはいけない|ないといけない|ている||
|ja-gram-n5-n5-quote-to-omou-fill-0|明日は雨が降る{___}。<br>(I think it will rain tomorrow.)|と思います|ている|に行く|ましょう||
|ja-gram-n5-n5-quote-to-omou-fill-1|彼は正しい{___}。<br>(I think he is right.)|と思います|たい|ませんか|が||
|ja-gram-n5-n5-quote-to-omou-fill-2|これは難しい{___}か。<br>(Do you think this is difficult?)|と思います|をください|ないでください|てはいけない||
|ja-gram-n5-n5-quote-to-omou-fill-3|日本語を勉強したほうがいい{___}。<br>(I think you should study Japanese.)|と思います|てもいい|てから|のが好き||
|ja-gram-n5-n5-req-wo-kudasai-fill-0|水{___}。<br>(Please give me water.)|をください|なくてもいい|も|てもいい||
|ja-gram-n5-n5-req-wo-kudasai-fill-1|これ{___}。<br>(Please give me this.)|をください|ちゃいけない|なくてもいい|の||
|ja-gram-n5-n5-req-wo-kudasai-fill-2|メニュー{___}。<br>(Please give me the menu.)|をください|のが上手|なくてもいい|か〜か||
|ja-gram-n5-n5-req-wo-kudasai-fill-3|少し時間{___}。<br>(Please give me a little time.)|をください|の|もう|なくてもいい||
|ja-gram-n5-n5-should-hou-ga-ii-fill-0|早く寝た{___}ですよ。<br>(You had better sleep early.)|ほうがいい|から|と思う|ないでください||
|ja-gram-n5-n5-should-hou-ga-ii-fill-1|医者に行った{___}と思います。<br>(I think you should go to the doctor.)|ほうがいい|てください|つもり|たい||
|ja-gram-n5-n5-should-hou-ga-ii-fill-2|お酒を飲まない{___}ですよ。<br>(You had better not drink alcohol.)|ほうがいい|なくてはいけない|ちゃいけない|てはいけない||
|ja-gram-n5-n5-should-hou-ga-ii-fill-3|傘を持っていった{___}よ。<br>(You'd better take an umbrella.)|ほうがいい|てもいい|つもり|たい||
|ja-gram-n5-n5-skill-no-ga-heta-fill-0|私は歌う{___}です。<br>(I am bad at singing.)|のが下手|でしょう|なくてはいけない|がほしい||
|ja-gram-n5-n5-skill-no-ga-heta-fill-1|彼は字を書く{___}です。<br>(He is bad at writing characters.)|のが下手|のが好き|のが上手|てもいい||
|ja-gram-n5-n5-skill-no-ga-heta-fill-2|料理する{___}で、よく失敗します。<br>(I am bad at cooking and often fail.)|のが下手|てはいけない|ましょうか|ないといけない||
|ja-gram-n5-n5-skill-no-ga-heta-fill-3|運転する{___}なので、電車で行きます。<br>(Since I am bad at driving, I go by train.)|のが下手|ましょうか|てください|ちゃいけない||
|ja-gram-n5-n5-skill-no-ga-jozu-fill-0|彼は絵を描く{___}です。<br>(He is good at drawing pictures.)|のが上手|てもいい|たり〜たり|ないでください||
|ja-gram-n5-n5-skill-no-ga-jozu-fill-1|私は料理をする{___}ではありません。<br>(I am not good at cooking.)|のが上手|なくてはならない|なくちゃ|は||
|ja-gram-n5-n5-skill-no-ga-jozu-fill-2|田中さんはピアノを弾く{___}です。<br>(Tanaka-san is good at playing piano.)|のが上手|たい|いっしょに|なくてはいけない||
|ja-gram-n5-n5-skill-no-ga-jozu-fill-3|泳ぐ{___}ですね。<br>(You are good at swimming, aren't you.)|のが上手|てある|なくちゃ|てもいい||
|ja-gram-n5-n5-skill-no-ga-suki-fill-0|音楽を聴く{___}です。<br>(I like listening to music.)|のが好き|より〜ほうが|に行く|をください||
|ja-gram-n5-n5-skill-no-ga-suki-fill-1|本を読む{___}ですか。<br>(Do you like reading books?)|のが好き|つもり|すぎる|たり〜たり||
|ja-gram-n5-n5-skill-no-ga-suki-fill-2|料理を作る{___}です。<br>(I like making food.)|のが好き|たり〜たり|たい|まだ〜ていません||
|ja-gram-n5-n5-skill-no-ga-suki-fill-3|外で遊ぶ{___}な子供です。<br>(This is a child who likes playing outside.)|のが好き|てください|どんな|と思う||
|ja-gram-n5-n5-time-mada-te-imasen-fill-0|{___}宿題をしていません。<br>(I haven't done my homework yet.)|まだ|たり〜たり|なくてはならない|もう||
|ja-gram-n5-n5-time-mada-te-imasen-fill-1|{___}ご飯を食べていません。<br>(I haven't eaten yet.)|まだ|は〜より|ちゃいけない|ましょうか||
|ja-gram-n5-n5-time-mada-te-imasen-fill-2|{___}映画を見ていません。<br>(I haven't seen the movie yet.)|まだ|もう|は|ている||
|ja-gram-n5-n5-time-mada-te-imasen-fill-3|彼は{___}来ていません。<br>(He hasn't come yet.)|まだ|どうして|てから|たい||
|ja-gram-n5-n5-verb-cha-ikenai-fill-0|そこに入っ{___}よ。<br>(You mustn't go in there.)|ちゃいけない|がほしい|てもいい|のが上手||
|ja-gram-n5-n5-verb-cha-ikenai-fill-1|嘘をつい{___}。<br>(You mustn't tell lies.)|ちゃいけない|まだ〜ていません|はどうですか|てもいい||
|ja-gram-n5-n5-verb-cha-ikenai-fill-2|夜遅くまで起きて{___}よ。<br>(You mustn't stay up so late at night.)|ちゃいけない|てはいけない|のが好き|たり〜たり||
|ja-gram-n5-n5-verb-cha-ikenai-fill-3|授業をさぼっ{___}よ。<br>(You mustn't skip class.)|ちゃいけない|ないでください|つもり|が||
|ja-gram-n5-n5-verb-nai-de-kudasai-fill-0|ここで写真を撮ら{___}。<br>(Please do not take photos here.)|ないでください|のが下手|ちゃいけない|てはいけない||
|ja-gram-n5-n5-verb-nai-de-kudasai-fill-1|タバコを吸わ{___}。<br>(Please do not smoke.)|ないでください|と思う|てください|も||
|ja-gram-n5-n5-verb-nai-de-kudasai-fill-2|廊下で走ら{___}。<br>(Please do not run in the hallway.)|ないでください|てはいけない|で|なくちゃ||
|ja-gram-n5-n5-verb-nai-de-kudasai-fill-3|忘れ{___}。<br>(Please do not forget.)|ないでください|ちゃいけない|てある|のが上手||
|ja-gram-n5-n5-verb-naru-fill-0|春{___}。<br>(It has become spring.)|になりました|が|ないでください|にする||
|ja-gram-n5-n5-verb-naru-fill-1|日本語が上手{___}です。<br>(I want to become good at Japanese.)|になりたい|のが上手|方|ので||
|ja-gram-n5-n5-verb-naru-fill-2|医者に{___}ために勉強しています。<br>(I am studying to become a doctor.)|なる|てはいけない|がある|のが好き||
|ja-gram-n5-n5-verb-naru-fill-3|外が暗く{___}きました。<br>(It has gotten dark outside.)|なって|に|いちばん|のが好き||
|ja-gram-n5-n5-verb-ni-iku-fill-0|昼ご飯を食べ{___}。<br>(I am going to eat lunch.)|に行きます|と思う|ませんか|だけ||
|ja-gram-n5-n5-verb-ni-iku-fill-1|買い物{___}。<br>(Won't you come shopping with me?)|に行きませんか|ちゃいけない|まで|ませんか||
|ja-gram-n5-n5-verb-ni-iku-fill-2|図書館に本を借り{___}。<br>(I went to the library to borrow books.)|に行きました|ませんか|な|まだ〜ていません||
|ja-gram-n5-n5-verb-ni-iku-fill-3|海を見{___}です。<br>(I want to go see the ocean.)|に行きたい|てもいい|のが好き|にする||
|ja-gram-n5-n5-verb-ni-suru-fill-0|コーヒー{___}。<br>(I'll have coffee.)|にします|なくてはいけない|なくてもいい|ないでください||
|ja-gram-n5-n5-verb-ni-suru-fill-1|これ{___}。<br>(I'll go with this one.)|にします|てはいけない|すぎる|たことがある||
|ja-gram-n5-n5-verb-ni-suru-fill-2|休み{___}。<br>(Let's make it a holiday.)|にしましょう|てはいけない|てもいい|たり〜たり||
|ja-gram-n5-n5-verb-ni-suru-fill-3|どれ{___}か。<br>(Which one will you choose?)|にします|なくてはいけない|たり〜たり|てはいけない||
|ja-gram-n5-n5-verb-sugiru-fill-0|食べ{___}。<br>(I ate too much.)|すぎました|のが好き|にする|つもり||
|ja-gram-n5-n5-verb-sugiru-fill-1|この荷物は重{___}。<br>(This luggage is too heavy.)|すぎます|てはいけない|たり〜たり|ないでください||
|ja-gram-n5-n5-verb-sugiru-fill-2|昨日飲み{___}。<br>(I drank too much yesterday.)|すぎた|にする|てください|が||
|ja-gram-n5-n5-verb-sugiru-fill-3|この映画は長{___}。<br>(This movie is too long.)|すぎます|いつも|ている|ないでください||
|ja-gram-n5-n5-verb-sugiru-fill-4|働き{___}でください。<br>(Please don't overwork yourself.)|すぎない|てから|ましょうか|んです||
|ja-gram-n5-n5-verb-ta-koto-ga-aru-fill-0|日本に行っ{___}。<br>(I have been to Japan before.)|たことがあります|ている|ましょう|ましょうか||
|ja-gram-n5-n5-verb-ta-koto-ga-aru-fill-1|富士山に登っ{___}か。<br>(Have you ever climbed Mt. Fuji?)|たことがあります|ませんか|にする|ないでください||
|ja-gram-n5-n5-verb-ta-koto-ga-aru-fill-2|お寿司を食べ{___}。<br>(I have never eaten sushi.)|たことがありません|ませんか|がある|ので||
|ja-gram-n5-n5-verb-ta-koto-ga-aru-fill-3|歌舞伎を見{___}か。<br>(Have you ever seen Kabuki?)|たことがあります|のが好き|なくてもいい|ないでください||
|ja-gram-n5-n5-verb-tai-fill-0|日本に行き{___}です。<br>(I want to go to Japan.)|たい|この|てください|つもり||
|ja-gram-n5-n5-verb-tai-fill-1|どこに行き{___}ですか?<br>(Where do you want to go?)|たい|てください|のが下手|つもり||
|ja-gram-n5-n5-verb-tai-fill-2|日本語を学び{___}です。<br>(I want to learn Japanese.)|たい|は|ている|すぎる||
|ja-gram-n5-n5-verb-tai-fill-3|日本で英語をおしえ{___}です。<br>(I want to teach English in Japan.)|たい|前に|なくちゃ|ほうがいい||
|ja-gram-n5-n5-verb-tai-fill-4|水が飲み{___}。<br>(I want to drink water.)|たい|ましょうか|がほしい|どうやって||
|ja-gram-n5-n5-verb-tari-tari-fill-0|週末は映画を見{___}、買い物をしたりします。<br>(On weekends I do things like watch movies and go shopping.)|たり|ちゃいけない|てから|たことがある|SELF_ANSWERING|
|ja-gram-n5-n5-verb-tari-tari-fill-1|音楽を聴い{___}、本を読んだりするのが好きです。<br>(I like to do things like listen to music and read books.)|たり|てください|てある|ないでください||
|ja-gram-n5-n5-verb-tari-tari-fill-2|立っ{___}座ったりしないでください。<br>(Please don't keep standing up and sitting down.)|たり|ほうがいい|が|のが好き|SELF_ANSWERING|
|ja-gram-n5-n5-verb-tari-tari-fill-3|笑っ{___}泣いたりしました。<br>(I laughed and cried (alternately).)|たり|と|のが上手|てもいい|SELF_ANSWERING|
|ja-gram-n5-n5-verb-te-aru-fill-0|窓が開け{___}。<br>(The window has been opened (and is open).)|てあります|がほしい|ている|に行く||
|ja-gram-n5-n5-verb-te-aru-fill-1|名前が書い{___}。<br>(A name is written (there).)|てあります|てから|たり〜たり|が||
|ja-gram-n5-n5-verb-te-aru-fill-2|花が飾っ{___}。<br>(Flowers have been arranged.)|てあります|つもり|てください|は||
|ja-gram-n5-n5-verb-te-aru-fill-3|ドアが閉め{___}。<br>(The door has been closed.)|てあります|より〜ほうが|がほしい|ましょうか||
|ja-gram-n5-n5-verb-te-iru-fill-0|今、ご飯を食べ{___}。<br>(I am eating right now.)|ています|てある|方|てはいけない||
|ja-gram-n5-n5-verb-te-iru-fill-1|彼は結婚し{___}。<br>(He is married.)|ています|ちゃいけない|の|なくてもいい||
|ja-gram-n5-n5-verb-te-iru-fill-2|雨が降っ{___}。<br>(It is raining.)|ています|な|ほうがいい|なくてはいけない||
|ja-gram-n5-n5-verb-te-iru-fill-4|電気がつい{___}。<br>(The light is on.)|ています|方|より〜ほうが|ましょうか||
|ja-gram-n5-n5-verb-te-kara-fill-0|結婚し{___}も私働いていいわよ。<br>(I don't mind if I keep working after we're married.)|てから|もう|ないといけない|じゃない||
|ja-gram-n5-n5-verb-te-kara-fill-1|ご飯を食べ{___}、勉強します。<br>(After eating, I will study.)|てから|ている|なくてはいけない|でしょう||
|ja-gram-n5-n5-verb-te-kara-fill-2|手を洗っ{___}食べてください。<br>(Please wash your hands before eating. (lit: after washing hands, eat))|てから|もう|まだ|なくちゃ||
|ja-gram-n5-n5-verb-te-kara-fill-3|学校を卒業し{___}、日本に行きたいです。<br>(After graduating from school, I want to go to Japan.)|てから|いちばん|ないでください|てある||
|ja-gram-n5-n5-verb-te-kara-fill-4|宿題をし{___}、テレビを見ます。<br>(After doing homework, I watch TV.)|てから|ましょう|と思う|は||
|ja-gram-n5-n5-verb-te-kudasai-fill-0|ここに名前を書い{___}。<br>(Please write your name here.)|てください|ないといけない|のが上手|で||
|ja-gram-n5-n5-verb-te-kudasai-fill-1|ゆっくり話し{___}。<br>(Please speak slowly.)|てください|ないといけない|ましょうか|なくてはならない||
|ja-gram-n5-n5-verb-te-kudasai-fill-2|窓を開け{___}。<br>(Please open the window.)|てください|か|ないでください|に行く||
|ja-gram-n5-n5-verb-te-kudasai-fill-3|もう一度言っ{___}。<br>(Please say it one more time.)|てください|てもいい|方|たり〜たり||
|ja-gram-n5-n5-verb-te-kudasai-fill-4|ちょっと待っ{___}。<br>(Please wait a moment.)|てください|たことがある|か|てもいい||
|ja-gram-n5-n5-verb-te-mo-ii-fill-0|ここに座っ{___}ですか。<br>(May I sit here?)|てもいい|ちゃいけない|ないでください|のが上手||
|ja-gram-n5-n5-verb-te-mo-ii-fill-1|写真を撮っ{___}ですよ。<br>(You may take a photo.)|てもいい|ちゃいけない|てください|てはいけない||
|ja-gram-n5-n5-verb-te-mo-ii-fill-2|明日来{___}です。<br>(It's okay to come tomorrow.)|てもいい|すぎる|なくてもいい|ちゃいけない||
|ja-gram-n5-n5-verb-te-mo-ii-fill-3|日本語で話し{___}ですか。<br>(May I speak in Japanese?)|てもいい|すぎる|てはいけない|なくてはならない||
|ja-gram-n5-n5-verb-te-mo-ii-fill-4|帰っ{___}ですよ。<br>(You may go home.)|てもいい|ないでください|か〜か|ちゃいけない||
|ja-gram-n5-n5-verb-te-wa-ikenai-fill-0|ここで食べ{___}。<br>(You must not eat here.)|てはいけません|ないでください|ちゃいけない|何||
|ja-gram-n5-n5-verb-te-wa-ikenai-fill-1|図書館で大きな声を出し{___}。<br>(You must not speak loudly in the library.)|てはいけません|なくちゃ|にする|いくら||
|ja-gram-n5-n5-verb-te-wa-ikenai-fill-2|嘘をつい{___}。<br>(You must not tell lies.)|てはいけない|てください|ないといけない|ちゃいけない||
|ja-gram-n5-n5-verb-te-wa-ikenai-fill-3|授業中に携帯を使っ{___}。<br>(You must not use your phone during class.)|てはいけません|ないでください|まだ〜ていません|ないといけない||
|ja-gram-n5-n5-want-ga-hoshii-fill-0|新しいパソコン{___}です。<br>(I want a new computer.)|がほしい|つもり|なくてはいけない|たり〜たり||
|ja-gram-n5-n5-want-ga-hoshii-fill-1|お水{___}ですか。<br>(Do you want some water?)|がほしい|ほうがいい|なくてはいけない|つもり||
|ja-gram-n5-n5-want-ga-hoshii-fill-2|子供の頃、犬{___}。<br>(When I was a child, I wanted a dog.)|がほしかった|も|たことがある|つもり||
|ja-gram-n5-n5-want-ga-hoshii-fill-3|もっと時間{___}。<br>(I want more time.)|がほしい|ちゃいけない|お|がいる||
|ja-gram-n5-n5-way-kata-fill-0|この漢字の読み{___}を教えてください。<br>(Please teach me how to read this kanji.)|方|たことがある|にする|なくちゃ|LENGTH_TELL|
|ja-gram-n5-n5-way-kata-fill-1|ご飯の炊き{___}を知っていますか。<br>(Do you know how to cook rice?)|方|てもいい|はどうですか|にする|LENGTH_TELL|
|ja-gram-n5-n5-way-kata-fill-2|この機械の使い{___}が分かりません。<br>(I don't know how to use this machine.)|方|ちゃいけない|の中で〜が一番|から|LENGTH_TELL|
|ja-gram-n5-n5-way-kata-fill-3|日本語の書き{___}を勉強しています。<br>(I am studying how to write Japanese.)|方|は|ちゃいけない|に行く|LENGTH_TELL|
