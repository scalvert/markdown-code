# Complex Line Range Patterns

This demonstrates various line range patterns.

## Single Line

Just the header:

```text snippet=data.txt#L1
Header line
```

## Range from Start

From line 2 to 6:

```text snippet=data.txt#L2-L6
Section 1 start
  Item 1.1
  Item 1.2
  Item 1.3
Section 1 end
```

## Single Line in Middle

Just item 2.2:

```text snippet=data.txt#L9
  Item 2.2
```

## Range to End

From line 12 to end:

```text snippet=data.txt#L12-
Section 3 start
  Item 3.1
  Item 3.2
  Item 3.3
Section 3 end
Footer line
```

## Large Range

Multiple sections:

```text snippet=data.txt#L7-L11
Section 2 start
  Item 2.1
  Item 2.2
  Item 2.3
Section 2 end
```
