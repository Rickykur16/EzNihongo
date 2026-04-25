import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/kanji.dart';
import '../providers/app_providers.dart';
import '../services/fsrs.dart';
import '../widgets/rating_buttons.dart';

class ReviewScreen extends ConsumerStatefulWidget {
  final String level;
  const ReviewScreen({super.key, required this.level});

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  List<Kanji>? _queue;
  int _index = 0;
  bool _flipped = false;
  int _correct = 0;
  int _wrong = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(_buildQueue);
  }

  Future<void> _buildQueue() async {
    final repo = await ref.read(kanjiRepositoryProvider.future);
    final fsrs = await ref.read(fsrsProvider.future);
    final ids = fsrs.buildSession(repo.idsForLevel(widget.level), newLimit: 10);
    final kanjiList =
        ids.map((id) => repo.byId(id)).whereType<Kanji>().toList(growable: false);
    if (!mounted) return;
    setState(() {
      _queue = kanjiList;
      _index = 0;
      _flipped = false;
    });
  }

  Future<void> _rate(int rating) async {
    final queue = _queue;
    if (queue == null || _index >= queue.length) return;
    final kanji = queue[_index];

    final fsrs = await ref.read(fsrsProvider.future);
    await fsrs.reviewCard(kanji.id, rating);
    ref.read(fsrsRevisionProvider.notifier).state =
        FsrsRevision(DateTime.now().millisecondsSinceEpoch);

    if (!mounted) return;
    setState(() {
      if (rating == 1) {
        _wrong += 1;
      } else {
        _correct += 1;
      }
      _index += 1;
      _flipped = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final queue = _queue;
    return Scaffold(
      appBar: AppBar(
        title: Text('Review ${widget.level}'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: queue == null
            ? const Center(child: CircularProgressIndicator())
            : queue.isEmpty
                ? _EmptyState(level: widget.level, onBack: () => context.pop())
                : _index >= queue.length
                    ? _DoneState(
                        correct: _correct,
                        wrong: _wrong,
                        total: queue.length,
                        onBack: () => context.pop(),
                      )
                    : _ReviewBody(
                        kanji: queue[_index],
                        flipped: _flipped,
                        progress: _index / queue.length,
                        position: _index + 1,
                        total: queue.length,
                        onFlip: () => setState(() => _flipped = !_flipped),
                        onRate: _rate,
                      ),
      ),
    );
  }
}

class _ReviewBody extends StatelessWidget {
  final Kanji kanji;
  final bool flipped;
  final double progress;
  final int position;
  final int total;
  final VoidCallback onFlip;
  final void Function(int rating) onRate;

  const _ReviewBody({
    required this.kanji,
    required this.flipped,
    required this.progress,
    required this.position,
    required this.total,
    required this.onFlip,
    required this.onRate,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          LinearProgressIndicator(value: progress),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: Text('$position / $total',
                style: Theme.of(context).textTheme.labelMedium),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: GestureDetector(
              onTap: onFlip,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                transitionBuilder: (child, anim) =>
                    FadeTransition(opacity: anim, child: child),
                child: flipped
                    ? _BackFace(key: const ValueKey('back'), kanji: kanji)
                    : _FrontFace(key: const ValueKey('front'), kanji: kanji),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (!flipped)
            FilledButton.tonal(
              onPressed: onFlip,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Lihat jawaban',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            )
          else
            RatingButtons(onRated: onRate),
        ],
      ),
    );
  }
}

class _FrontFace extends StatelessWidget {
  final Kanji kanji;
  const _FrontFace({super.key, required this.kanji});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              kanji.character,
              style: const TextStyle(fontSize: 144, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            Text(
              'Tap untuk lihat arti',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _BackFace extends StatelessWidget {
  final Kanji kanji;
  const _BackFace({super.key, required this.kanji});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Text(
                  kanji.character,
                  style: const TextStyle(fontSize: 96, fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(height: 16),
              if (kanji.onReading.isNotEmpty)
                _ReadingRow('音 (On)', kanji.onReading, scheme.primary),
              if (kanji.kunReading.isNotEmpty)
                _ReadingRow('訓 (Kun)', kanji.kunReading, scheme.tertiary),
              const SizedBox(height: 12),
              Text(
                kanji.meaning,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
              ),
              if (kanji.vocab.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Contoh kata',
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 6),
                ...kanji.vocab.take(3).map((v) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Text(
                        '${v.word} (${v.reading}) — ${v.meaning}',
                        style: const TextStyle(fontSize: 14),
                      ),
                    )),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ReadingRow extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _ReadingRow(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(label,
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: color)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String level;
  final VoidCallback onBack;
  const _EmptyState({required this.level, required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.celebration_outlined, size: 64),
            const SizedBox(height: 12),
            Text(
              'Tidak ada kartu yang due di $level',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Kembali nanti atau pilih level lain.',
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: onBack, child: const Text('Kembali')),
          ],
        ),
      ),
    );
  }
}

class _DoneState extends StatelessWidget {
  final int correct;
  final int wrong;
  final int total;
  final VoidCallback onBack;

  const _DoneState({
    required this.correct,
    required this.wrong,
    required this.total,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline, size: 64),
            const SizedBox(height: 12),
            Text('Selesai!',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text('$correct benar · $wrong salah · $total kartu'),
            const SizedBox(height: 16),
            FilledButton(onPressed: onBack, child: const Text('Kembali')),
          ],
        ),
      ),
    );
  }
}
