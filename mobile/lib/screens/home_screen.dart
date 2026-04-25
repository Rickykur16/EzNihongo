import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/kanji.dart';
import '../providers/app_providers.dart';
import '../services/fsrs.dart';
import '../widgets/kanji_tile.dart';
import '../widgets/progress_ring.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedLevel = ref.watch(selectedLevelProvider);
    final kanjiAsync = ref.watch(levelKanjiProvider(selectedLevel));
    final statsAsync = ref.watch(levelStatsProvider(selectedLevel));
    final fsrsAsync = ref.watch(fsrsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kanji', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () {},
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _LevelTabs(
              selected: selectedLevel,
              onChanged: (lv) => ref.read(selectedLevelProvider.notifier).state = lv,
            ),
            Expanded(
              child: statsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Error: $e')),
                data: (stats) => kanjiAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Error: $e')),
                  data: (kanjiList) => _HomeContent(
                    level: selectedLevel,
                    stats: stats,
                    kanjiList: kanjiList,
                    fsrsEngine: fsrsAsync.valueOrNull,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LevelTabs extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const _LevelTabs({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: kJlptLevels.map((lv) {
          final isSelected = lv == selected;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => onChanged(lv),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? scheme.primary : scheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    lv,
                    style: TextStyle(
                      color: isSelected ? scheme.onPrimary : scheme.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _HomeContent extends StatelessWidget {
  final String level;
  final FsrsStats stats;
  final List<Kanji> kanjiList;
  final FsrsEngine? fsrsEngine;

  const _HomeContent({
    required this.level,
    required this.stats,
    required this.kanjiList,
    required this.fsrsEngine,
  });

  @override
  Widget build(BuildContext context) {
    final progress = stats.total > 0 ? stats.learnedCount / stats.total : 0.0;
    final scheme = Theme.of(context).colorScheme;

    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          sliver: SliverToBoxAdapter(
            child: Row(
              children: [
                ProgressRing(
                  progress: progress,
                  size: 120,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${stats.learnedCount}',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: scheme.onSurface,
                        ),
                      ),
                      Text(
                        'dari ${stats.total}',
                        style: TextStyle(
                          fontSize: 12,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$level · ${stats.total} kanji',
                        style: TextStyle(
                          fontSize: 14,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _StatRow('Due hari ini', stats.dueCount, scheme.primary),
                      _StatRow('Baru', stats.newCount, scheme.tertiary),
                      _StatRow('Mature', stats.matureCount, scheme.secondary),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: stats.dueCount == 0 && stats.newCount == 0
                            ? null
                            : () => context.push('/review/$level'),
                        icon: const Icon(Icons.school_outlined),
                        label: Text(
                          stats.dueCount > 0
                              ? 'Review ${stats.dueCount} kartu'
                              : 'Mulai belajar',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          sliver: SliverToBoxAdapter(
            child: Text(
              'Daftar Kanji',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 6,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1,
            ),
            delegate: SliverChildBuilderDelegate(
              (ctx, i) {
                final k = kanjiList[i];
                final state = fsrsEngine?.getCardState(k.id)?.state;
                return KanjiTile(
                  kanji: k,
                  state: state,
                  onTap: () => context.push('/kanji/${k.id}'),
                );
              },
              childCount: kanjiList.length,
            ),
          ),
        ),
      ],
    );
  }
}

class _StatRow extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _StatRow(this.label, this.count, this.color);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 13)),
          const Spacer(),
          Text(
            '$count',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
