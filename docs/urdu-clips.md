# Urdu voice clips (tiny-urdu)

`public/audio/ur/*.mp3` (13 clips) were generated locally with the open model
[Zafar205/tiny-urdu](https://github.com/Zafar205/tiny-urdu) (voice `M2`, speed 1.0), then trimmed and encoded to 64 kbps mono MP3.
Punjabi and English clips do not exist yet, so those fall back to the phone's voice.

**Status: unreviewed.** Nobody has listened to these on a phone, and a native speaker has not checked the wording.
The tiny-urdu repo has no LICENSE file and its training data (UrduTTS) licence has not been confirmed: check both before a public release.

Input is Roman Urdu (capital `T`/`D`/`R` inside a word = retroflex). The model's phonemizer mispronounced `gaya`/`gaye`, so those two
clips use explicit IPA (`ipa:` prefix).

| Clip | Roman Urdu / IPA input | Urdu text spoken by the app |
|---|---|---|
| turn-left | baayen muRein. | بائیں مڑیں |
| turn-right | daayen muRein. | دائیں مڑیں |
| straight | seedha chalein. | سیدھا چلیں |
| u-turn | yooTarn lein. | یو ٹرن لیں |
| roundabout | chauraahe mein daakhil hon. | چوراہے میں داخل ہوں |
| merge | saRak mein shaamil hon. | سڑک میں شامل ہوں |
| arrive | aap kee manzil saamne hai. | آپ کی منزل سامنے ہے |
| depart | rawaana hon. | روانہ ہوں |
| start | navigeshan shuroo ho rahi hai. | نیویگیشن شروع ہو رہی ہے |
| reroute | ipa:raːstaː doːbaːraː teː kɪjaː ɡɪjaː | راستہ دوبارہ طے کیا گیا |
| arrived | ipa:aːp apniː manzɪl par pahʊnc ɡɪjeː hẽ | آپ اپنی منزل پر پہنچ گئے ہیں |
| d500 | paanch sau meeTar baad, | ۵۰۰ میٹر بعد |
| d200 | do sau meeTar baad, | ۲۰۰ میٹر بعد |
