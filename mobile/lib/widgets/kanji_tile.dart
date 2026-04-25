import 'package:flutter/material.dart';
import '../models/kanji.dart';
import '../services/fsrs.dart';

class KanjiTile extends StatelessWidget {
  final Kanji kanji;
  final CardState? state;
  final VoidCallback? onTap;

  const KanjiTile({
    super.key,
    required this.kanji,
    this.state,
    this.onTap,
  });

  Color _bgFor(BuildContext ctx) {
    final scheme = Theme.of(ctx).colorScheme;
    switch (state) {
      case CardState.review:
        return scheme.primaryContainer;
      case CardState.learning:
      case CardState.relearning:
        return scheme.tertiaryContainer;
      case CardState.newCard:
      case null:
        return scheme.surfaceContainerHighest;
    }
  }

  Color _fgFor(BuildContext ctx) {
    final scheme = Theme.of(ctx).colorScheme;
    switch (state) {
      case CardState.review:
        return scheme.onPrimaryContainer;
      case CardState.learning:
      case CardState.relearning:
        return scheme.onTertiaryContainer;
      case CardState.newCard:
      case null:
        return scheme.onSurface;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: _bgFor(context),
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.center,
        child: Text(
          kanji.character,
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w600,
            color: _fgFor(context),
          ),
        ),
      ),
    );
  }
}
