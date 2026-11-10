# Research and interpretation

Checked against primary sources in the design session, 9 November 2026. These sources motivate test inputs; they are not results for this repository. The supplied research notes contained broader claims that this implementation deliberately does not adopt.

| Source | Supported motivation | Limit for this target |
| --- | --- | --- |
| [VoiceJailbreak](https://arxiv.org/abs/2405.19103) | Narrative framing changed voice content-safety behavior | Harmful content compliance is not unauthorized tool execution |
| [Audio taxonomy](https://arxiv.org/html/2605.30031) | Delivery variation and benign-refusal measurement matter | Ten open audio-language models; not measured on this STT pipeline |
| [AudioHijack](https://arxiv.org/html/2604.14604v1) | Optimized audio can affect responses and tool use | No perturbation optimizer here. Commercial transfer tool-misuse results differ from aggregate behavior ranges; no over-air claim |
| [Concurrent audio injection](https://arxiv.org/abs/2607.28165) | Background instructions deserve evaluation | Physical tests used a Doubao smartphone; do not attribute that physical test to GPT-4o/Gemini |
| [Wharton persuasion study](https://gail.wharton.upenn.edu/research-and-insights/persuading-llms-initial-study/) | Authority and commitment are candidate strategies | Preliminary study concerned objectionable responses, including insults; no measured comparison to trained human agents |
| [PAP](https://arxiv.org/abs/2401.06373v2), [Crescendo](https://arxiv.org/html/2404.01833v2) | Persuasion and multi-turn escalation motivate conversations | Text-demonstrated; voice transfer requires measurement. Our frozen scripts are not adaptive implementations of these methods |
| [ForcedLeak](https://noma.security/blog/forcedleak-agent-risks-exposed-in-salesforce-agentforce), [Comet](https://brave.com/blog/comet-prompt-injection/) | External retrieved content can redirect agents | Disclosed research demonstrations; not proof of exploitation of all deployments |
| [CaMeL](https://arxiv.org/abs/2503.18813) | External policy and control/data separation | This reference Gate is not CaMeL and does not implement provenance tracking |

Do not infer universal failure rates, automatic transfer from text to voice, human inferiority, automatic policy discovery, or legal obligations from these studies. Diarization does not establish identity or authority. A tool gate cannot prevent all spoken leakage from data already in model context. Conventional authentication, authorization and constrained data access remain relevant baselines.

The supplied notes also listed EchoLeak, calendar injection, Cursor, memory poisoning, Atlas, ServiceNow, customer-service controversies and human voice fraud. Those are not implemented or claimed as reproduced here; their broad incident summaries and financial/legal assertions require separate source-specific verification before publication as factual case studies. No benchmark percentages or fraud-loss statistics are used as product claims.

AudioHijack, ultrasonic hidden commands, voice cloning, speaker verification, telephony, background source separation and automatic attack optimization are outside this implementation. Uploading a mixed recording tests this target's actual transcription behavior; it does not recreate a paper's complete threat model.
