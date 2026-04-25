import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_tts/flutter_tts.dart';
import '../models/kanji.dart';
import '../providers/app_providers.dart';

class DetailScreen extends ConsumerStatefulWidget {
  final String kanjiId;
  const DetailScreen({super.key, required this.kanjiId});

  @override
  ConsumerState<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends ConsumerState<DetailScreen> {
  late final FlutterTts _tts;

  @override
  void initState() {
    super.initState();
    _tts = FlutterTts()
      ..setLanguage('ja-JP')
      ..setSpeechRate(0.5);
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }

  Future<void> _speak(String text) async {
    if (text.isEmpty) return;
    await _tts.stop();
    await _tts.speak(text);
  }

  @override
  Widget build(BuildContext context) {
    final repoAsync = ref.watch(kanjiRepositoryProvider);
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: const Text('Detail'),
      ),
      body: SafeArea(
        child: repoAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (repo) {
            final k = repo.byId(widget.kanjiId);
            if (k == null) {
              return Center(child: Text('Kanji ${widget.kanjiId} tidak ditemukan'));
            }
            return _DetailBody(kanji: k, onSpeak: _speak);
          },
        ),
      ),
    );
  }
}

class _DetailBody extends StatelessWidget {
  final Kanji kanji;
  final Future<void> Function(String) onSpeak;

  const _DetailBody({required this.kanji, required this.onSpeak});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Center(
          child: Text(
            kanji.character,
            style: const TextStyle(fontSize: 144, fontWeight: FontWeight.w600),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: scheme.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              kanji.level,
              style: TextStyle(
                  color: scheme.onPrimaryContainer, fontWeight: FontWeight.w600),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (kanji.onReading.isNotEmpty)
                  _Row('音 (On)', kanji.onReading, scheme.primary),
                if (kanji.kunReading.isNotEmpty)
                  _Row('訓 (Kun)', kanji.kunReading, scheme.tertiary),
                const Divider(height: 24),
                Text(
                  kanji.meaning,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ),
        if (kanji.vocab.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Kosakata',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...kanji.vocab.map(
            (v) => Card(
              child: ListTile(
                title: Text(
                  '${v.word}  ·  ${v.reading}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(v.meaning),
                trailing: IconButton(
                  icon: const Icon(Icons.volume_up_outlined),
                  onPressed: () => onSpeak(v.word),
                ),
              ),
            ),
          ),
        ],
        if (kanji.sentences.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Contoh Kalimat',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...kanji.sentences.map(
            (s) => Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            s.japanese,
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.volume_up_outlined),
                          onPressed: () => onSpeak(s.japanese),
                        ),
                      ],
                    ),
                    if (s.reading.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          s.reading,
                          style: TextStyle(
                              fontSize: 13, color: scheme.onSurfaceVariant),
                        ),
                      ),
                    const SizedBox(height: 8),
                    Text(s.indonesian, style: const TextStyle(fontSize: 14)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _Row(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(label,
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: color)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }
}
